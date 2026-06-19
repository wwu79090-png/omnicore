#ifndef OMNICORE_CORE_H
#define OMNICORE_CORE_H

#ifdef __cplusplus
extern "C" {
#endif

int omni_version(void);

int omni_store_create(void);
int omni_store_set_i32(int store_id, int key, int value);
int omni_store_get_i32(int store_id, int key, int fallback);
int omni_store_has(int store_id, int key);
int omni_store_clear(int store_id);

int omni_eventbus_create(void);
int omni_eventbus_emit(int bus_id, int event_id, int payload);
int omni_eventbus_pending(int bus_id);
int omni_eventbus_drain(int bus_id);
int omni_eventbus_last_event(int bus_id);
int omni_eventbus_last_payload(int bus_id);

int omni_ecs_create(int capacity);
int omni_ecs_create_entity(int world_id);
int omni_ecs_destroy_entity(int world_id, int entity_id);
int omni_ecs_is_alive(int world_id, int entity_id);
int omni_ecs_add_position(int world_id, int entity_id, float x, float y);
int omni_ecs_add_velocity(int world_id, int entity_id, float x, float y);
float omni_ecs_get_position_x(int world_id, int entity_id);
float omni_ecs_get_position_y(int world_id, int entity_id);
int omni_ecs_step_movement(int world_id, float delta);

#ifdef __cplusplus
}
#endif

#endif
