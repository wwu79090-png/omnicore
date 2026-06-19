#include "../include/omnicore_core.h"

#define OMNI_MAX_STORES 32
#define OMNI_MAX_STORE_KEYS 64
#define OMNI_MAX_BUSES 32
#define OMNI_MAX_WORLDS 8
#define OMNI_MAX_ENTITIES 1024

typedef struct {
  int has;
  int value;
} OmniStoreSlot;

typedef struct {
  int pending;
  int last_event;
  int last_payload;
} OmniEventBusState;

typedef struct {
  int alive;
  int has_position;
  float x;
  float y;
  float vx;
  float vy;
} OmniEntityState;

typedef struct {
  int capacity;
  int next_entity;
  int alive_count;
  OmniEntityState entities[OMNI_MAX_ENTITIES + 1];
} OmniWorldState;

static int next_store_id = 1;
static int next_bus_id = 1;
static int next_world_id = 1;
static OmniStoreSlot stores[OMNI_MAX_STORES][OMNI_MAX_STORE_KEYS];
static OmniEventBusState buses[OMNI_MAX_BUSES];
static OmniWorldState worlds[OMNI_MAX_WORLDS];

int omni_version(void) {
  return 1;
}

int omni_store_create(void) {
  if (next_store_id >= OMNI_MAX_STORES) return 0;
  return next_store_id++;
}

int omni_store_set_i32(int store_id, int key, int value) {
  if (store_id <= 0 || store_id >= OMNI_MAX_STORES) return 0;
  if (key < 0 || key >= OMNI_MAX_STORE_KEYS) return 0;
  stores[store_id][key].has = 1;
  stores[store_id][key].value = value;
  return 1;
}

int omni_store_get_i32(int store_id, int key, int fallback) {
  if (store_id <= 0 || store_id >= OMNI_MAX_STORES) return fallback;
  if (key < 0 || key >= OMNI_MAX_STORE_KEYS) return fallback;
  return stores[store_id][key].has ? stores[store_id][key].value : fallback;
}

int omni_store_has(int store_id, int key) {
  if (store_id <= 0 || store_id >= OMNI_MAX_STORES) return 0;
  if (key < 0 || key >= OMNI_MAX_STORE_KEYS) return 0;
  return stores[store_id][key].has;
}

int omni_store_clear(int store_id) {
  if (store_id <= 0 || store_id >= OMNI_MAX_STORES) return 0;
  for (int key = 0; key < OMNI_MAX_STORE_KEYS; key += 1) {
    stores[store_id][key].has = 0;
    stores[store_id][key].value = 0;
  }
  return 1;
}

int omni_eventbus_create(void) {
  if (next_bus_id >= OMNI_MAX_BUSES) return 0;
  return next_bus_id++;
}

int omni_eventbus_emit(int bus_id, int event_id, int payload) {
  if (bus_id <= 0 || bus_id >= OMNI_MAX_BUSES) return 0;
  buses[bus_id].last_event = event_id;
  buses[bus_id].last_payload = payload;
  buses[bus_id].pending += 1;
  return buses[bus_id].pending;
}

int omni_eventbus_pending(int bus_id) {
  if (bus_id <= 0 || bus_id >= OMNI_MAX_BUSES) return 0;
  return buses[bus_id].pending;
}

int omni_eventbus_drain(int bus_id) {
  if (bus_id <= 0 || bus_id >= OMNI_MAX_BUSES) return 0;
  int pending = buses[bus_id].pending;
  buses[bus_id].pending = 0;
  return pending;
}

int omni_eventbus_last_event(int bus_id) {
  if (bus_id <= 0 || bus_id >= OMNI_MAX_BUSES) return 0;
  return buses[bus_id].last_event;
}

int omni_eventbus_last_payload(int bus_id) {
  if (bus_id <= 0 || bus_id >= OMNI_MAX_BUSES) return 0;
  return buses[bus_id].last_payload;
}

int omni_ecs_create(int capacity) {
  if (next_world_id >= OMNI_MAX_WORLDS) return 0;
  int world_id = next_world_id++;
  if (capacity < 1) capacity = 1;
  if (capacity > OMNI_MAX_ENTITIES) capacity = OMNI_MAX_ENTITIES;
  worlds[world_id].capacity = capacity;
  worlds[world_id].next_entity = 1;
  worlds[world_id].alive_count = 0;
  return world_id;
}

int omni_ecs_create_entity(int world_id) {
  if (world_id <= 0 || world_id >= OMNI_MAX_WORLDS) return 0;
  OmniWorldState *world = &worlds[world_id];
  if (world->next_entity > world->capacity) return 0;
  int entity_id = world->next_entity++;
  world->entities[entity_id].alive = 1;
  world->entities[entity_id].has_position = 0;
  world->entities[entity_id].x = 0;
  world->entities[entity_id].y = 0;
  world->entities[entity_id].vx = 0;
  world->entities[entity_id].vy = 0;
  world->alive_count += 1;
  return entity_id;
}

int omni_ecs_destroy_entity(int world_id, int entity_id) {
  if (!omni_ecs_is_alive(world_id, entity_id)) return 0;
  worlds[world_id].entities[entity_id].alive = 0;
  worlds[world_id].entities[entity_id].has_position = 0;
  worlds[world_id].alive_count -= 1;
  return 1;
}

int omni_ecs_is_alive(int world_id, int entity_id) {
  if (world_id <= 0 || world_id >= OMNI_MAX_WORLDS) return 0;
  if (entity_id <= 0 || entity_id > OMNI_MAX_ENTITIES) return 0;
  return worlds[world_id].entities[entity_id].alive;
}

int omni_ecs_add_position(int world_id, int entity_id, float x, float y) {
  if (!omni_ecs_is_alive(world_id, entity_id)) return 0;
  worlds[world_id].entities[entity_id].has_position = 1;
  worlds[world_id].entities[entity_id].x = x;
  worlds[world_id].entities[entity_id].y = y;
  return 1;
}

int omni_ecs_add_velocity(int world_id, int entity_id, float x, float y) {
  if (!omni_ecs_is_alive(world_id, entity_id)) return 0;
  worlds[world_id].entities[entity_id].vx = x;
  worlds[world_id].entities[entity_id].vy = y;
  return 1;
}

float omni_ecs_get_position_x(int world_id, int entity_id) {
  if (!omni_ecs_is_alive(world_id, entity_id)) return 0;
  return worlds[world_id].entities[entity_id].x;
}

float omni_ecs_get_position_y(int world_id, int entity_id) {
  if (!omni_ecs_is_alive(world_id, entity_id)) return 0;
  return worlds[world_id].entities[entity_id].y;
}

int omni_ecs_step_movement(int world_id, float delta) {
  if (world_id <= 0 || world_id >= OMNI_MAX_WORLDS) return 0;
  OmniWorldState *world = &worlds[world_id];
  for (int entity_id = 1; entity_id < world->next_entity; entity_id += 1) {
    OmniEntityState *entity = &world->entities[entity_id];
    if (!entity->alive || !entity->has_position) continue;
    entity->x += entity->vx * delta;
    entity->y += entity->vy * delta;
  }
  return 1;
}
