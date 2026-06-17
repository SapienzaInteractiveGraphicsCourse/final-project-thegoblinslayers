import * as THREE from 'three';

export const PLAYER_SPEED = 5.5;
export const PLAYER_HALF_SIZE = new THREE.Vector3(0.45, 0.9, 0.45);
export const PLAYER_HEIGHT = 1.8;
export const EYE_HEIGHT = 1.6;

export const ROOM_HEIGHT = 4.4;
export const INTERACTION_DISTANCE = 3.0;

export const PASSAGE_WIDTH = 2.4;
export const DOOR_OPENING_WIDTH = PASSAGE_WIDTH;
export const DOOR_OPENING_HEIGHT = 2.8;
export const DOOR_CENTER_GAP = 0.01;

export const DOOR_POSITION = new THREE.Vector3(0, 0, -12);
export const LEFT_DOOR_CLOSED_ANGLE = 0;
export const RIGHT_DOOR_CLOSED_ANGLE = 0;
export const LEFT_DOOR_OPEN_ANGLE = -Math.PI / 2;
export const RIGHT_DOOR_OPEN_ANGLE = Math.PI / 2;
export const DOOR_ROTATION_SPEED = 2.2;

export const LEVER_HANDLE_REST_ANGLE = 0;
export const LEVER_HANDLE_ACTIVE_ANGLE = -Math.PI / 2;
export const LEVER_HANDLE_ROTATION_SPEED = 4.0;

export const MOUSE_SENSITIVITY = 0.0025;
export const MAX_PITCH = Math.PI / 2 - 0.1;

export const SPRINT_MULTIPLIER = 1.85;   // sprint speed compared to walk
export const STAMINA_DRAIN_RATE = 1 / 3; // runs out in 3s
export const STAMINA_REGEN_RATE = 1 / 2; // recharges in 2s