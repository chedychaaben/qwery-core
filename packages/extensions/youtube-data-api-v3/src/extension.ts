import * as qwery from '@qwery/extensions-sdk';

import { makeYouTubeDriver } from './driver';

export function activate(context: qwery.ExtensionContext) {
  context.subscriptions.push(
    qwery.datasources.registerDriver(
      'youtube-data-api-v3.default',
      (ctx) => makeYouTubeDriver(ctx),
      'node',
    ),
  );
}

// Expose a stable factory export for the runtime loader
export const driverFactory = makeYouTubeDriver;
export default driverFactory;

