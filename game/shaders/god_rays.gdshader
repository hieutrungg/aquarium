shader_type canvas_item;
render_mode unshaded;

uniform vec2 rect_size = vec2(600.0, 300.0);
uniform float intensity : hint_range(0.0, 1.0) = 0.55;
uniform vec4 light_color : source_color = vec4(0.839216, 0.941176, 0.909804, 1.0);

void fragment() {
	vec2 p = floor(UV * rect_size);
	float beam = 0.0;
	for (int i = 0; i < 4; i++) {
		float center = rect_size.x * (0.08 + float(i) * 0.245);
		float sway = round(sin(TIME * 0.21 + float(i) * 2.0) * 5.0);
		float distance_to_ray = abs(p.x - center - p.y * 0.28 - sway);
		beam = max(beam, 1.0 - smoothstep(5.0, 28.0, distance_to_ray));
	}
	float bands = floor(clamp(beam * (1.0 - p.y / rect_size.y * 0.7), 0.0, 0.999) * 3.0) / 2.0;
	COLOR = vec4(light_color.rgb, bands * 0.12 * intensity);
}
