import EventBus from '../core/EventBus.js';

export class MultiplayerSession {
  constructor({
    room = null,
    events = new EventBus(),
    reconnect = { retries: 3, delayMs: 500 },
    authority = 'server'
  } = {}) {
    this.room = room;
    this.events = events;
    this.reconnect = reconnect;
    this.authority = authority;
    this.joinedRoom = null;
    this.state = {};
    this.predicted = [];
    this.snapshots = [];
  }

  join(roomName, payload = {}) {
    this.joinedRoom = roomName;
    this.room?.join?.(roomName, payload);
    this.events.emit('multiplayer:join', { room: roomName, payload });
    return this;
  }

  applyServerState(nextState = {}, { tick = this.snapshots.length } = {}) {
    const previous = this.state;
    this.snapshots.push({ tick, state: clone(nextState) });
    this.state = clone(nextState);
    const diff = diffState(previous, this.state);
    this.events.emit('multiplayer:state', { tick, state: this.state, diff });
    return diff;
  }

  predict(action, reducer = defaultPredictionReducer) {
    const prediction = {
      id: `prediction-${this.predicted.length + 1}`,
      action,
      before: clone(this.state)
    };
    this.state = reducer(this.state, action);
    prediction.after = clone(this.state);
    this.predicted.push(prediction);
    this.events.emit('multiplayer:predict', prediction);
    return prediction;
  }

  rollback(predictionId = null) {
    const index = predictionId
      ? this.predicted.findIndex((item) => item.id === predictionId)
      : this.predicted.length - 1;
    if (index < 0) return null;
    const prediction = this.predicted[index];
    this.state = clone(prediction.before);
    this.predicted.splice(index);
    this.events.emit('multiplayer:rollback', prediction);
    return clone(this.state);
  }

  reconnectPlan(reason = 'disconnect') {
    return {
      reason,
      retries: Number(this.reconnect.retries ?? 3),
      delayMs: Number(this.reconnect.delayMs ?? 500),
      room: this.joinedRoom
    };
  }
}

function diffState(previous = {}, next = {}) {
  const changed = {};
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  for (const key of keys) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) {
      changed[key] = { before: previous[key], after: next[key] };
    }
  }
  return changed;
}

function defaultPredictionReducer(state, action = {}) {
  if (action.type === 'move') {
    return {
      ...clone(state),
      x: Number(state.x || 0) + Number(action.dx || 0),
      y: Number(state.y || 0) + Number(action.dy || 0)
    };
  }
  return {
    ...clone(state),
    lastAction: action
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export default MultiplayerSession;
