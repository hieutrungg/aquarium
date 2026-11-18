shader_type canvas_item;
render_mode unshaded;

uniform float turbidity : hint_range(0.0, 1.0) = 0.0;
uniform vec4 murk_color : source_color = vec4(0.658824, 0.776471, 0.52549, 1.0);

void fragment() {
	// A canvas overlay: no screen texture, render pass or Forward+ dependency.
	vec2 pixel = floor(FRAGCOORD.xy);
	float dither = mod(pixel.x + pixel.y, 2.0) * 0.025;
	vec3 gray_green = mix(murk_color.rgb, vec3(0.56, 0.61, 0.56), turbidity * 0.4);
	COLOR = vec4(gray_green, turbidity * (0.48 + dither));
}
