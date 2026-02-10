import subprocess
import os
import uuid


def compose_video(
    a_roll_path: str,
    b_rolls: list,
    output_dir="/tmp"
):
    """
    b_rolls = [
      {
        "path": "/tmp/b1.mp4",
        "start": 7,
        "duration": 5
      }
    ]
    """

    output_path = os.path.join(output_dir, f"final_{uuid.uuid4()}.mp4")

    inputs = ["-i", a_roll_path]
    filters = []
    last_video = "[0:v]"

    for i, b in enumerate(b_rolls):
        inputs += ["-i", b["path"]]

        start = b["start"]
        duration = b["duration"]
        end = start + duration

        filters.append(
            f"[{i+1}:v]trim=0:{duration},setpts=PTS+{start}/TB[v{i}]"
        )
        filters.append(
            f"{last_video}[v{i}]overlay=enable='between(t,{start},{end})'[vout{i}]"
        )

        last_video = f"[vout{i}]"

    filter_complex = ";".join(filters)

    cmd = [
        "ffmpeg",
        "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", last_video,
        "-map", "0:a?",
        "-c:v", "libx264",
        "-c:a", "aac",
        "-shortest",
        output_path
    ]

    subprocess.run(cmd, check=True)
    return output_path
