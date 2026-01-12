import json
import numpy as np
from model import load_model

model = load_model()

with open("tags.json") as f:
    tags = json.load(f)

tag_texts = [t["text"] for t in tags]
tag_ids = [t["id"] for t in tags]

embeddings = model.encode(tag_texts, normalize_embeddings=True)

np.save("tag_embeddings.npy", embeddings)
np.save("tag_ids.npy", tag_ids)

print("Tags embedded successfully.")
