import * as React from 'react';
import renderer, { act } from 'react-test-renderer';

import { ThemedText } from '../ThemedText';

it(`renders correctly`, async () => {
  let root!: renderer.ReactTestRenderer;
  // React 19 では描画が非同期のため、act で描画の完了を待つ
  await act(async () => {
    root = renderer.create(<ThemedText>Snapshot test!</ThemedText>);
  });

  expect(root.toJSON()).toMatchSnapshot();
});
