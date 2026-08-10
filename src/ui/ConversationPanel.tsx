import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ConversationPort } from '../application/effects/ConversationPort';
import { useReducedMotion } from '../application/accessibility';
import { conversationPromptSuggestions } from '../ai/conversation/intent';
import { cueForConversationTurn, type VocalCueId } from '../audio/vocal-cue-policy';
import type { WorldState } from '../domain/state/schema';
import type { ViewportSize } from '../render/camera';
import { responsivePanelLayout, type UiScale } from '../render/responsive-layout';
import { authoredBeginFallback, conversationGenerationNote } from './conversation-feedback';
import { uiMetrics } from './ui-metrics';

type Line = Readonly<{ speaker: 'player' | 'npc'; text: string }>;

type ConversationPanelProps = Readonly<{
  npcId: string;
  port: ConversationPort;
  state: WorldState;
  onPausedState: (state: WorldState) => void;
  onStableState: (state: WorldState, committed: boolean) => void;
  onDismiss: () => void;
  onVocalCue: (cue: VocalCueId) => void;
  surface: ViewportSize;
  uiScale: UiScale;
}>;

function idPart(source: string): string {
  return source.replaceAll('_', '-').replace(/[^a-z0-9-]/gu, '-').slice(0, 28);
}

export function ConversationPanel({
  npcId, port, state, onPausedState, onStableState, onDismiss, onVocalCue, surface, uiScale,
}: ConversationPanelProps) {
  const initialState = useRef(state);
  const reducedMotion = useReducedMotion();
  const conversationId = useMemo(
    () => `conversation-${idPart(npcId)}-${initialState.current.revision}-${initialState.current.clock.absoluteMinute}`,
    [npcId],
  );
  const [displayName, setDisplayName] = useState(npcId);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'opening' | 'ready' | 'generating' | 'revealing' | 'action-complete' | 'ambient' | 'failed'>('opening');
  const [reveal, setReveal] = useState('');
  const [generationNote, setGenerationNote] = useState('LOCAL MODEL LOADING…');
  const [suggestions, setSuggestions] = useState(() => conversationPromptSuggestions(initialState.current, npcId));
  const turnNumber = useRef(0);
  const active = useRef(false);
  const closing = useRef(false);
  const revealTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const panelLayout = responsivePanelLayout(surface, uiScale);
  const metrics = uiMetrics(uiScale);

  useEffect(() => {
    let mounted = true;
    void port.beginConversation({ conversationId, npcId, state: initialState.current }).then((result) => {
      if (!mounted) {
        if (result.kind === 'active') void port.abortConversation({ conversationId });
        return;
      }
      setDisplayName(result.displayName);
      if (result.kind === 'ambient') {
        setLines([{ speaker: 'npc', text: result.dialogue }]);
        setGenerationNote('AUTHORED AMBIENT DIALOGUE');
        setStatus('ambient');
      } else {
        active.current = true;
        onPausedState(result.pausedState);
        setLines([{ speaker: 'npc', text: result.greeting }]);
        setGenerationNote('LOCAL MODEL READY');
        setStatus('ready');
      }
      onVocalCue('greeting');
    }).catch(() => {
      if (mounted) {
        const fallback = authoredBeginFallback(npcId);
        setDisplayName(fallback.displayName);
        setLines([{ speaker: 'npc', text: fallback.dialogue }]);
        setGenerationNote('LOCAL MODEL UNAVAILABLE · SAFE FALLBACK USED');
        setStatus('ambient');
        onVocalCue('sigh');
      }
    });
    return () => {
      mounted = false;
      if (revealTimer.current) clearInterval(revealTimer.current);
      if (active.current && !closing.current) void port.abortConversation({ conversationId });
    };
  }, [conversationId, npcId, onPausedState, onVocalCue, port]);

  const sendMessage = async (message: string) => {
    if (!active.current || status !== 'ready' || !message) return;
    turnNumber.current += 1;
    const turnId = `turn-${idPart(npcId)}-${turnNumber.current}`;
    setDraft('');
    setLines((current) => [...current, { speaker: 'player', text: message }]);
    setStatus('generating');
    try {
      const [result] = await Promise.all([
        port.sendConversationTurn({ conversationId, turnId, message }),
        new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 180)),
      ]);
      setGenerationNote(conversationGenerationNote(result.source));
      const cue = cueForConversationTurn(result);
      if (cue) onVocalCue(cue);
      setSuggestions(result.promptSuggestions);
      if (reducedMotion) {
        setLines((current) => [...current, { speaker: 'npc', text: result.dialogue }]);
        setStatus(result.intent === 'end_conversation' ? 'action-complete' : 'ready');
        return;
      }
      setStatus('revealing');
      setReveal('');
      let index = 0;
      if (revealTimer.current) clearInterval(revealTimer.current);
      revealTimer.current = setInterval(() => {
        index += 1;
        setReveal(result.dialogue.slice(0, index));
        if (index >= result.dialogue.length) {
          if (revealTimer.current) clearInterval(revealTimer.current);
          revealTimer.current = undefined;
          setLines((current) => [...current, { speaker: 'npc', text: result.dialogue }]);
          setReveal('');
          setStatus(result.intent === 'end_conversation' ? 'action-complete' : 'ready');
        }
      }, 12);
    } catch {
      setLines((current) => [...current, { speaker: 'npc', text: 'I cannot talk right now.' }]);
      setGenerationNote('LOCAL MODEL UNAVAILABLE · SAFE FALLBACK USED');
      onVocalCue('sigh');
      setStatus('ready');
    }
  };

  const send = async () => {
    const message = draft.trim();
    if (!message) return;
    setDraft('');
    await sendMessage(message);
  };

  const close = async (commit: boolean) => {
    if (closing.current) return;
    closing.current = true;
    if (revealTimer.current) {
      clearInterval(revealTimer.current);
      revealTimer.current = undefined;
    }
    try {
      if (active.current) {
        const result = commit
          ? await port.endConversation({ conversationId })
          : await port.abortConversation({ conversationId });
        active.current = false;
        onStableState(result.state, commit);
      }
    } finally {
      onDismiss();
    }
  };

  return (
    <View nativeID="world-ui-conversation-overlay" style={styles.overlay}>
      <View
        accessibilityLabel={`Conversation with ${displayName}`}
        nativeID="world-ui-conversation-panel"
        style={[styles.panel, { height: panelLayout.height, padding: metrics.padding, width: panelLayout.width }]}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { fontSize: metrics.secondaryText }]}>CONVERSATION · TIME PAUSED</Text>
            <Text style={[styles.name, { fontSize: metrics.titleText }]}>{displayName.toUpperCase()}</Text>
          </View>
          <Pressable accessibilityLabel="Cancel conversation" onPress={() => void close(false)} style={[styles.smallButton, { minHeight: metrics.pointerTarget }]}>
            <Text style={[styles.smallButtonText, { fontSize: metrics.secondaryText }]}>CANCEL</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[styles.transcriptContent, { padding: metrics.padding }]}
          nativeID="conversation-transcript"
          style={styles.transcript}
        >
          <Text accessibilityLiveRegion="polite" nativeID="conversation-model-status" style={[styles.modelStatus, { fontSize: metrics.secondaryText, lineHeight: Math.round(metrics.secondaryText * 1.5) }]}>{generationNote}</Text>
          {lines.slice(-6).map((line, index) => (
            <Text
              key={`${line.speaker}-${index}`}
              style={[
                line.speaker === 'npc' ? styles.npcLine : styles.playerLine,
                { fontSize: metrics.conversationText, lineHeight: Math.round(metrics.conversationText * 1.5) },
              ]}
            >
              {line.speaker === 'npc' ? `${displayName}: ` : 'YOU: '}{line.text}
            </Text>
          ))}
          {status === 'generating' ? <Text accessibilityLabel="NPC is thinking" style={[styles.thinking, { fontSize: metrics.conversationText }]}>●  ●  ●</Text> : null}
          {status === 'revealing' ? <Text style={[styles.npcLine, { fontSize: metrics.conversationText, lineHeight: Math.round(metrics.conversationText * 1.5) }]}>{displayName}: {reveal}</Text> : null}
          {status === 'failed' ? <Text style={[styles.error, { fontSize: metrics.panelText }]}>CONVERSATION COULD NOT START</Text> : null}
        </ScrollView>
        {status === 'ambient' || status === 'failed' ? (
          <Pressable accessibilityLabel="Close dialogue" onPress={() => void close(false)} style={[styles.endButton, { minHeight: metrics.primaryControl }]}>
            <Text style={[styles.endText, { fontSize: metrics.persistentText }]}>CLOSE</Text>
          </Pressable>
        ) : (
          status === 'action-complete' ? (
            <View style={styles.actionCompleteRow}>
              <Text style={[styles.actionComplete, { fontSize: metrics.secondaryText }]}>ACTION RECORDED · END OR CANCEL THIS CONVERSATION</Text>
              <Pressable accessibilityLabel="End conversation" onPress={() => void close(true)} style={[styles.endButton, { minHeight: metrics.primaryControl }]}>
                <Text style={[styles.endText, { fontSize: metrics.persistentText }]}>END</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View nativeID="conversation-prompt-suggestions" style={styles.actionRow}>
                {suggestions.map((suggestion) => (
                  <Pressable
                    accessibilityLabel={`Use ${suggestion.label.toLowerCase()} prompt idea`}
                    disabled={status !== 'ready'}
                    key={suggestion.id}
                    onPress={() => setDraft(suggestion.suggestedText)}
                    style={[styles.actionButton, { minHeight: metrics.pointerTarget }]}
                  >
                    <Text style={[styles.actionText, { fontSize: metrics.secondaryText }]}>{suggestion.label}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.inputRow}>
              <TextInput
                accessibilityLabel="Conversation message"
                editable={status === 'ready'}
                maxLength={500}
                onChangeText={setDraft}
                onSubmitEditing={() => void send()}
                placeholder="TYPE WHAT YOU WANT TO SAY…"
                placeholderTextColor="#7e6f5b"
                style={[styles.input, { fontSize: metrics.conversationText, minHeight: metrics.primaryControl }]}
                value={draft}
              />
              <Pressable accessibilityLabel="Send conversation message" disabled={status !== 'ready' || draft.trim().length === 0} onPress={() => void send()} style={[styles.sendButton, { minHeight: metrics.primaryControl }]}>
                <Text style={[styles.sendText, { fontSize: metrics.persistentText }]}>SAY</Text>
              </Pressable>
              <Pressable accessibilityLabel="End conversation" disabled={status === 'generating' || status === 'revealing'} onPress={() => void close(true)} style={[styles.endButton, { minHeight: metrics.primaryControl }]}>
                <Text style={[styles.endText, { fontSize: metrics.persistentText }]}>END</Text>
              </Pressable>
              </View>
            </>
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionComplete: { color: '#e2bf76', fontFamily: 'Silkscreen', fontSize: 8, marginTop: 12 },
  actionCompleteRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  actionButton: { borderColor: '#8b6846', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionText: { color: '#e2bf76', fontFamily: 'Silkscreen', fontSize: 8 },
  endButton: { alignItems: 'center', backgroundColor: '#6f4931', borderColor: '#d6a45d', borderWidth: 1, justifyContent: 'center', minHeight: 38, paddingHorizontal: 14 },
  endText: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 9 },
  error: { color: '#ef725b', fontFamily: 'Silkscreen', fontSize: 10 },
  eyebrow: { color: '#c89b5e', fontFamily: 'Silkscreen', fontSize: 8 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerCopy: { flexShrink: 1 },
  input: { backgroundColor: '#181512', borderColor: '#76573d', borderWidth: 1, color: '#fff0c7', flex: 1, fontFamily: 'Silkscreen', fontSize: 10, minHeight: 38, paddingHorizontal: 10 },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  name: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 18, marginTop: 3 },
  modelStatus: { color: '#c89b5e', fontFamily: 'Silkscreen', fontSize: 9, lineHeight: 15, marginBottom: 10 },
  npcLine: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 10, lineHeight: 17, marginBottom: 8 },
  overlay: { alignItems: 'center', backgroundColor: '#100d0acc', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0, zIndex: 50 },
  panel: { backgroundColor: '#252019', borderColor: '#c58b4b', borderWidth: 2 },
  playerLine: { color: '#9fc58e', fontFamily: 'Silkscreen', fontSize: 10, lineHeight: 17, marginBottom: 8 },
  sendButton: { alignItems: 'center', backgroundColor: '#d3a04c', justifyContent: 'center', minHeight: 38, paddingHorizontal: 16 },
  sendText: { color: '#211d1a', fontFamily: 'Silkscreen', fontSize: 10 },
  smallButton: { borderColor: '#76573d', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  smallButtonText: { color: '#c3b18f', fontFamily: 'Silkscreen', fontSize: 8 },
  thinking: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 10, letterSpacing: 5 },
  transcript: { backgroundColor: '#1b1713', flex: 1, marginTop: 12, minHeight: 96 },
  transcriptContent: { flexGrow: 1 },
});
