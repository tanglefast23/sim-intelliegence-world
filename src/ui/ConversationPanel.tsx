import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ConversationPort } from '../application/effects/ConversationPort';
import { conversationPromptSuggestions } from '../ai/conversation/intent';
import type { WorldState } from '../domain/state/schema';

type Line = Readonly<{ speaker: 'player' | 'npc'; text: string }>;

type ConversationPanelProps = Readonly<{
  npcId: string;
  port: ConversationPort;
  state: WorldState;
  onPausedState: (state: WorldState) => void;
  onStableState: (state: WorldState, committed: boolean) => void;
  onDismiss: () => void;
}>;

function idPart(source: string): string {
  return source.replaceAll('_', '-').replace(/[^a-z0-9-]/gu, '-').slice(0, 28);
}

export function ConversationPanel({
  npcId, port, state, onPausedState, onStableState, onDismiss,
}: ConversationPanelProps) {
  const initialState = useRef(state);
  const conversationId = useMemo(
    () => `conversation-${idPart(npcId)}-${initialState.current.revision}-${initialState.current.clock.absoluteMinute}`,
    [npcId],
  );
  const [displayName, setDisplayName] = useState(npcId);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'opening' | 'ready' | 'generating' | 'revealing' | 'action-complete' | 'ambient' | 'failed'>('opening');
  const [reveal, setReveal] = useState('');
  const [suggestions, setSuggestions] = useState(() => conversationPromptSuggestions(initialState.current, npcId));
  const turnNumber = useRef(0);
  const active = useRef(false);
  const closing = useRef(false);

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
        setStatus('ambient');
      } else {
        active.current = true;
        onPausedState(result.pausedState);
        setLines([{ speaker: 'npc', text: result.greeting }]);
        setStatus('ready');
      }
    }).catch(() => {
      if (mounted) setStatus('failed');
    });
    return () => {
      mounted = false;
      if (active.current && !closing.current) void port.abortConversation({ conversationId });
    };
  }, [conversationId, npcId, onPausedState, port]);

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
      setSuggestions(result.promptSuggestions);
      setStatus('revealing');
      setReveal('');
      let index = 0;
      const timer = setInterval(() => {
        index += 1;
        setReveal(result.dialogue.slice(0, index));
        if (index >= result.dialogue.length) {
          clearInterval(timer);
          setLines((current) => [...current, { speaker: 'npc', text: result.dialogue }]);
          setReveal('');
          setStatus(result.intent === 'end_conversation' ? 'action-complete' : 'ready');
        }
      }, 12);
    } catch {
      setLines((current) => [...current, { speaker: 'npc', text: 'I cannot talk right now.' }]);
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
      <View accessibilityLabel={`Conversation with ${displayName}`} nativeID="world-ui-conversation-panel" style={styles.panel}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>CONVERSATION · TIME PAUSED</Text>
            <Text style={styles.name}>{displayName.toUpperCase()}</Text>
          </View>
          <Pressable accessibilityLabel="Cancel conversation" onPress={() => void close(false)} style={styles.smallButton}>
            <Text style={styles.smallButtonText}>CANCEL</Text>
          </Pressable>
        </View>
        <View nativeID="conversation-transcript" style={styles.transcript}>
          {lines.slice(-6).map((line, index) => (
            <Text key={`${line.speaker}-${index}`} style={line.speaker === 'npc' ? styles.npcLine : styles.playerLine}>
              {line.speaker === 'npc' ? `${displayName}: ` : 'YOU: '}{line.text}
            </Text>
          ))}
          {status === 'generating' ? <Text accessibilityLabel="NPC is thinking" style={styles.thinking}>●  ●  ●</Text> : null}
          {status === 'revealing' ? <Text style={styles.npcLine}>{displayName}: {reveal}</Text> : null}
          {status === 'failed' ? <Text style={styles.error}>CONVERSATION COULD NOT START</Text> : null}
        </View>
        {status === 'ambient' || status === 'failed' ? (
          <Pressable accessibilityLabel="Close dialogue" onPress={() => void close(false)} style={styles.endButton}>
            <Text style={styles.endText}>CLOSE</Text>
          </Pressable>
        ) : (
          status === 'action-complete' ? (
            <View style={styles.actionCompleteRow}>
              <Text style={styles.actionComplete}>ACTION RECORDED · END OR CANCEL THIS CONVERSATION</Text>
              <Pressable accessibilityLabel="End conversation" onPress={() => void close(true)} style={styles.endButton}>
                <Text style={styles.endText}>END</Text>
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
                    style={styles.actionButton}
                  >
                    <Text style={styles.actionText}>{suggestion.label}</Text>
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
                style={styles.input}
                value={draft}
              />
              <Pressable accessibilityLabel="Send conversation message" disabled={status !== 'ready' || draft.trim().length === 0} onPress={() => void send()} style={styles.sendButton}>
                <Text style={styles.sendText}>SAY</Text>
              </Pressable>
              <Pressable accessibilityLabel="End conversation" disabled={status === 'generating' || status === 'revealing'} onPress={() => void close(true)} style={styles.endButton}>
                <Text style={styles.endText}>END</Text>
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
  actionCompleteRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  actionButton: { borderColor: '#8b6846', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionText: { color: '#e2bf76', fontFamily: 'Silkscreen', fontSize: 8 },
  endButton: { alignItems: 'center', backgroundColor: '#6f4931', borderColor: '#d6a45d', borderWidth: 1, justifyContent: 'center', minHeight: 38, paddingHorizontal: 14 },
  endText: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 9 },
  error: { color: '#ef725b', fontFamily: 'Silkscreen', fontSize: 10 },
  eyebrow: { color: '#c89b5e', fontFamily: 'Silkscreen', fontSize: 8 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  input: { backgroundColor: '#181512', borderColor: '#76573d', borderWidth: 1, color: '#fff0c7', flex: 1, fontFamily: 'Silkscreen', fontSize: 10, minHeight: 38, paddingHorizontal: 10 },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  name: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 18, marginTop: 3 },
  npcLine: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 10, lineHeight: 17, marginBottom: 8 },
  overlay: { alignItems: 'center', backgroundColor: '#100d0acc', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0, zIndex: 50 },
  panel: { backgroundColor: '#252019', borderColor: '#c58b4b', borderWidth: 2, maxWidth: 760, padding: 18, width: '74%' },
  playerLine: { color: '#9fc58e', fontFamily: 'Silkscreen', fontSize: 10, lineHeight: 17, marginBottom: 8 },
  sendButton: { alignItems: 'center', backgroundColor: '#d3a04c', justifyContent: 'center', minHeight: 38, paddingHorizontal: 16 },
  sendText: { color: '#211d1a', fontFamily: 'Silkscreen', fontSize: 10 },
  smallButton: { borderColor: '#76573d', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  smallButtonText: { color: '#c3b18f', fontFamily: 'Silkscreen', fontSize: 8 },
  thinking: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 10, letterSpacing: 5 },
  transcript: { backgroundColor: '#1b1713', marginTop: 12, minHeight: 190, padding: 12 },
});
