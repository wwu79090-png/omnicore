export function activate(context) {
  context.subscriptions.push({
    dispose() {}
  });
}

export function deactivate() {}
