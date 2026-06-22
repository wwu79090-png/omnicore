import { createOmniError } from '../core/OmniError.js';

export class QuestStateMachine {
  constructor({ id = 'quest', stages = [] } = {}) {
    this.id = String(id);
    this.stages = stages.map(normalizeStage);
  }

  start() {
    return this._enterStage(0, { completed: false, rewards: null, history: [] });
  }

  progress(state = this.start(), objectiveId = '', amount = 1) {
    if (state.completed) return clone(state);
    const next = clone(state);
    const objective = next.objectives?.[objectiveId];
    if (!objective) return next;
    objective.current = Math.min(objective.target, Number(objective.current || 0) + Number(amount || 0));
    if (!Object.values(next.objectives).every((item) => item.current >= item.target)) return next;
    const nextIndex = next.stageIndex + 1;
    if (nextIndex >= this.stages.length) {
      return {
        ...next,
        completed: true,
        rewards: clone(this.stages[next.stageIndex]?.rewards || {}),
        history: [...next.history, next.stageId]
      };
    }
    return this._enterStage(nextIndex, {
      history: [...next.history, next.stageId],
      completed: false,
      rewards: null
    });
  }

  _enterStage(stageIndex, baseState = {}) {
    const stage = this.stages[stageIndex];
    if (!stage) throw createOmniError('QuestStateMachine', `Quest stage is not registered: ${stageIndex}`);
    return {
      questId: this.id,
      stageIndex,
      stageId: stage.id,
      objectives: Object.fromEntries(stage.objectives.map((objective) => [
        objective.id,
        { ...objective, current: 0 }
      ])),
      completed: Boolean(baseState.completed),
      rewards: clone(baseState.rewards || null),
      history: clone(baseState.history || [])
    };
  }
}

function normalizeStage(stage = {}, index = 0) {
  return {
    id: String(stage.id || `stage-${index}`),
    objectives: normalizeArray(stage.objectives).map((objective, objectiveIndex) => ({
      id: String(objective.id || `objective-${objectiveIndex}`),
      target: Number(objective.target || 1)
    })),
    rewards: clone(stage.rewards || {})
  };
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default QuestStateMachine;
