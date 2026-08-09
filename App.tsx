import { Silkscreen_400Regular } from '@expo-google-fonts/silkscreen';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { Asset } from 'expo-asset';
import * as Font from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { LoadingShell } from './src/application/LoadingShell';
import { type ResourceState, settleResourceGate } from './src/application/ResourceGate';

const proofAtlas = require('./assets/proof/phase2-atlas.png') as number;
const proofAudio = require('./assets/proof/phase2-tone.wav') as number;

export default function App() {
  const [resources, setResources] = useState<ResourceState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    const startedAt = performance.now();
    void settleResourceGate(async () => {
      const [, loadedAssets] = await Promise.all([
        Font.loadAsync({ Silkscreen: Silkscreen_400Regular }),
        Asset.loadAsync([proofAtlas, proofAudio]),
      ]);
      const imageAsset = loadedAssets.find((asset) => asset.name.includes('phase2-atlas'));
      if (!imageAsset) {
        throw new Error('Packaged image proof was not resolved.');
      }
      const audioAsset = loadedAssets.find((asset) => asset.name.includes('phase2-tone'));
      if (!audioAsset) {
        throw new Error('Packaged audio proof was not resolved.');
      }
      const [imageResponse, audioResponse] = await Promise.all([
        fetch(imageAsset.localUri ?? imageAsset.uri),
        fetch(audioAsset.localUri ?? audioAsset.uri),
      ]);
      if (!imageResponse.ok || (await imageResponse.arrayBuffer()).byteLength === 0) {
        throw new Error('Packaged image proof could not be loaded.');
      }
      if (!audioResponse.ok || (await audioResponse.arrayBuffer()).byteLength === 0) {
        throw new Error('Packaged audio proof could not be loaded.');
      }
      const remainingLoadingTime = Math.max(0, 500 - (performance.now() - startedAt));
      await new Promise((resolveDelay) => setTimeout(resolveDelay, remainingLoadingTime));
    }).then((nextState) => {
      if (active) {
        setResources(nextState);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (resources.status === 'failed') {
    return <LoadingShell detail={resources.detail} failed />;
  }

  if (resources.status === 'loading') {
    return <LoadingShell detail="Loading packaged font, image, and audio…" />;
  }

  return (
    <>
      <WithSkiaWeb
        componentProps={{ assetsLoaded: resources.assetsLoaded }}
        fallback={<LoadingShell detail="Loading CanvasKit…" />}
        getComponent={() => import('./src/render/SkiaProof')}
        opts={{ locateFile: () => '/canvaskit.wasm' }}
      />
      <StatusBar style="light" />
    </>
  );
}
