shader_type canvas_item;
render_mode unshaded;

uniform float turbidity : hint_range(0.0, 1.0) = 0.0;
uniform vec4 water_color : source_color = vec4(0.0);
uniform vec4 murk_color : source_color = vec4(0.658824, 0.776471, 0.52549, 1.0);

void fragment() {
	// A canvas overlay: no screen texture, render pass or Forward+ dependency.
	vec2 pixel = floor(FRAGCOORD.xy);
	float dither = mod(pixel.x + pixel.y, 2.0) * 0.025;
	vec3 gray_green = mix(murk_color.rgb, vec3(0.56, 0.61, 0.56), turbidity * 0.4);
	float murk_alpha = turbidity * (0.48 + dither);
	float alpha = water_color.a + murk_alpha * (1.0 - water_color.a);
	vec3 color = (water_color.rgb * water_color.a + gray_green * murk_alpha * (1.0 - water_color.a)) / max(alpha, 0.0001);
	COLOR = vec4(color, alpha);
}
