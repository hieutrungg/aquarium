shader_type canvas_item;
render_mode unshaded;
uniform bool flip = false;
uniform bool highlighted = false;
uniform float body_bend = 2.0;
uniform float fin_flutter = 0.5;
uniform float activity = 1.0;
uniform float phase = 0.0;
uniform vec2 body_x = vec2(0.15, 0.85);
varying vec4 tint;

void vertex() {
	tint = COLOR;
}

vec2 swim_uv(vec2 uv, vec2 texel) {
	if (flip) { uv.x = 1.0 - uv.x; }
	// Source image always faces right: the head (right bbox edge) barely moves.
	float tail = clamp((body_x.y - uv.x) / max(0.01, body_x.y - body_x.x), 0.0, 1.0);
	float wave = sin(TIME * (3.5 + activity * 5.0) + phase - tail * 5.0);
	float fins = sin(TIME * 12.0 + phase + tail * 8.0) * fin_flutter * tail * tail;
	float pixels = floor(wave * body_bend * tail * tail + fins + 0.5);
	uv.y -= pixels * texel.y;
	return uv;
}

void fragment() {
	vec2 source = swim_uv(UV, TEXTURE_PIXEL_SIZE);
	vec4 fish = texture(TEXTURE, source);
	if (source.y < 0.0 || source.y > 1.0) { fish = vec4(0.0); }
	if (highlighted && fish.a < 0.5) {
		float edge = max(max(texture(TEXTURE, swim_uv(UV + vec2(TEXTURE_PIXEL_SIZE.x, 0.0), TEXTURE_PIXEL_SIZE)).a, texture(TEXTURE, swim_uv(UV - vec2(TEXTURE_PIXEL_SIZE.x, 0.0), TEXTURE_PIXEL_SIZE)).a), max(texture(TEXTURE, swim_uv(UV + vec2(0.0, TEXTURE_PIXEL_SIZE.y), TEXTURE_PIXEL_SIZE)).a, texture(TEXTURE, swim_uv(UV - vec2(0.0, TEXTURE_PIXEL_SIZE.y), TEXTURE_PIXEL_SIZE)).a));
		fish = vec4(vec3(0.97647, 0.96078, 0.91373), step(0.5, edge));
	}
	COLOR = fish * tint;
}
