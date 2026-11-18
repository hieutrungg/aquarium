extends SceneTree
## Headless CPU frame/monitor benchmark; does not claim GPU/present performance.
func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var stage: Control = load("res://scenes/pixel_stage.tscn").instantiate()
	root.add_child(stage)
	for frame in range(5):
		await process_frame
	var main: Node2D = stage.get_node("Frame/Viewport/Main")
	for path in ["sample_scene_nature", "sample_scene_stress"]:
		var dto: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/dev/%s.json" % path))
		root.get_node("Bridge")._receive("scene:load", dto)
		for frame in range(180):
			await process_frame
		var total_cpu := 0.0
		var total_monitor := 0.0
		var started := Time.get_ticks_usec()
		for frame in range(600):
			await process_frame
			total_cpu += main.world.last_step_usec
			total_monitor += Performance.get_monitor(Performance.TIME_PROCESS) * 1000
		print("BENCHMARK fish=%d frames=600 world_cpu_ms=%.3f process_monitor_ms=%.3f wall_ms=%.3f renderer=headless" % [main.world.fishes.size(), total_cpu / 600000.0, total_monitor / 600.0, float(Time.get_ticks_usec() - started) / 600000.0])
	quit()
