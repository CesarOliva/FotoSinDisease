
from pathlib import Path

import numpy as np
import joblib

from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)


# =====================================
# CONFIGURACIÓN
# =====================================

BASE_DIR = Path(__file__).resolve().parent

DATA_FILE = BASE_DIR / "results" / "dinov2_embeddings.npz"
MODEL_DIR = BASE_DIR / "results"

MODEL_FILE = MODEL_DIR / "flora_classifier.joblib"


# =====================================
# CARGAR EMBEDDINGS
# =====================================

print("Cargando embeddings...")

data = np.load(DATA_FILE)

X = data["features"]
original_labels = data["labels"]
splits = data["splits"]

print(f"Total de imágenes: {len(X)}")
print(f"Características por imagen: {X.shape[1]}")


# =====================================
# CONVERTIR ETIQUETAS
# =====================================

# 0 = Sana
# 1 = Deteriorada

y = np.where(
    original_labels == "Healthy",
    0,
    1
)


# =====================================
# SEPARAR CONJUNTOS
# =====================================

X_train = X[splits == "train"]
y_train = y[splits == "train"]

X_val = X[splits == "validation"]
y_val = y[splits == "validation"]

X_test = X[splits == "test"]
y_test = y[splits == "test"]

print("\nDistribución:")

print(f"Train: {len(X_train)}")
print(f"Validation: {len(X_val)}")
print(f"Test: {len(X_test)}")


# =====================================
# CREAR CLASIFICADOR
# =====================================

classifier = Pipeline([
    ("scaler", StandardScaler()),

    ("logistic_regression", LogisticRegression(
        max_iter=2000,
        random_state=42
    ))
])


# =====================================
# ENTRENAMIENTO
# =====================================

print("\nEntrenando clasificador...")

classifier.fit(X_train, y_train)

print("Entrenamiento terminado.")


# =====================================
# EVALUACIÓN
# =====================================

def evaluate_model(name, X_data, y_data):

    predictions = classifier.predict(X_data)

    print(f"\n{'=' * 40}")
    print(f"EVALUACIÓN: {name}")
    print(f"{'=' * 40}")

    accuracy = accuracy_score(y_data, predictions)

    print(f"\nAccuracy: {accuracy:.4f}")

    print("\nReporte de clasificación:")

    print(classification_report(
        y_data,
        predictions,
        labels=[0, 1],
        target_names=["Sana", "Deteriorada"],
        zero_division=0
    ))

    print("Matriz de confusión:")
    print(confusion_matrix(
        y_data,
        predictions,
        labels=[0, 1]
    ))


# Primero validamos
evaluate_model(
    "VALIDATION",
    X_val,
    y_val
)

# Después hacemos la evaluación final
evaluate_model(
    "TEST",
    X_test,
    y_test
)


# =====================================
# GUARDAR MODELO
# =====================================

MODEL_DIR.mkdir(parents=True, exist_ok=True)

joblib.dump(classifier, MODEL_FILE)

print("\nModelo guardado correctamente:")
print(MODEL_FILE)
