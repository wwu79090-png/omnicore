export class RoomExitGraph {
  constructor({ rooms = {} } = {}) {
    this.rooms = Object.fromEntries(
      Object.entries(rooms || {}).map(([name, room]) => [name, normalizeRoom(room)])
    );
  }

  resolve(position = {}, variables = {}) {
    const roomName = String(position.room || '');
    const room = this.rooms[roomName] || normalizeRoom();
    const at = { x: Number(position.x || 0), y: Number(position.y || 0) };
    const ending = room.endings.find((item) => samePoint(item.at, at));
    if (ending) {
      return {
        type: 'ending',
        id: ending.id,
        room: roomName,
        dialog: ending.dialog || ''
      };
    }
    const exit = room.exits.find((item) => samePoint(item.at, at));
    if (!exit) return { type: 'none', room: roomName, at };
    if (!matchesWhen(exit.when, variables)) {
      return {
        type: 'locked',
        room: roomName,
        at,
        reason: 'condition-not-met'
      };
    }
    return {
      type: 'exit',
      from: { room: roomName, ...at },
      to: clone(exit.to),
      effect: exit.effect || null,
      dialog: exit.dialog || ''
    };
  }
}

function normalizeRoom(room = {}) {
  return {
    exits: normalizeArray(room.exits).map((exit) => ({
      at: normalizePoint(exit.at || exit.from),
      to: {
        room: String(exit.to?.room || exit.room || ''),
        x: Number(exit.to?.x ?? 0),
        y: Number(exit.to?.y ?? 0)
      },
      effect: exit.effect || null,
      dialog: exit.dialog || '',
      when: clone(exit.when || null)
    })),
    endings: normalizeArray(room.endings).map((ending) => ({
      at: normalizePoint(ending.at),
      id: String(ending.id || 'ending'),
      dialog: ending.dialog || ''
    }))
  };
}

function normalizePoint(point = {}) {
  return { x: Number(point.x || 0), y: Number(point.y || 0) };
}

function matchesWhen(when = null, variables = {}) {
  if (!when) return true;
  return Object.entries(when).every(([key, value]) => variables[key] === value);
}

function samePoint(left, right) {
  return Number(left.x) === Number(right.x) && Number(left.y) === Number(right.y);
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default RoomExitGraph;
