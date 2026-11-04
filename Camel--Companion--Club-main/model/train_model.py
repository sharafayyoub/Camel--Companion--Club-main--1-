"""
EduPulse - Motor de Alerta Temprana y Explicabilidad Pedagógica (XAI)
Hack4Edu 2026 - Reto 13 ProFuturo: La escuela que aprende de sus datos
Licencia: MIT Open Source

Nota ética: Este modelo actúa exclusivamente como sistema de apoyo a la decisión
docente (Human-in-the-loop). No realiza calificaciones ni sanciones automáticas.
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
import hashlib
import platform
import sklearn
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.dummy import DummyClassifier
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
    f1_score,
    recall_score
)

# 1. Datos completamente sintéticos: no proceden de alumnos ni son hashes.
def generate_anonymized_dataset(n_samples=500, random_state=42):
    rng = np.random.RandomState(random_state)
    
    # Identificadores ficticios secuenciales; no son SHA-256 ni anonimizan datos reales.
    student_ids = [f"ALU-{1000 + i}" for i in range(n_samples)]
    
    # Variables del reto ProFuturo
    asistencia_pct = np.clip(rng.normal(85, 12, n_samples), 40, 100)
    faltas_consecutivas = rng.poisson(1.2, n_samples)
    rendimiento_academico = np.clip(rng.normal(6.5, 1.8, n_samples), 1.0, 10.0)
    uso_recursos_profuturo = np.clip(rng.normal(60, 25, n_samples), 0, 100)
    horas_formacion_docente = rng.choice([2, 5, 10, 15, 20], n_samples)
    brecha_conectividad = rng.choice([0, 1, 2], n_samples, p=[0.5, 0.3, 0.2]) # 0: Buena, 1: Intermitente, 2: Nula

    # Lógica subyacente de riesgo para entrenamiento (con ruido realista)
    riesgo_score = (
        (100 - asistencia_pct) * 0.35 +
        (faltas_consecutivas * 8.0) +
        (10 - rendimiento_academico) * 4.5 +
        (100 - uso_recursos_profuturo) * 0.15 +
        (brecha_conectividad * 6.0) -
        (horas_formacion_docente * 0.4) +
        rng.normal(0, 4, n_samples)
    )

    # Clasificación en 3 niveles: 0 = Bajo (Verde), 1 = Medio (Amarillo), 2 = Alto (Rojo)
    nivel_riesgo = pd.cut(
        riesgo_score,
        bins=[-np.inf, 22, 38, np.inf],
        labels=[0, 1, 2]
    ).astype(int)

    df = pd.DataFrame({
        "student_id_hash": student_ids,
        "asistencia_pct": np.round(asistencia_pct, 1),
        "faltas_consecutivas": faltas_consecutivas,
        "rendimiento_academico": np.round(rendimiento_academico, 2),
        "uso_recursos_profuturo": np.round(uso_recursos_profuturo, 1),
        "horas_formacion_docente": horas_formacion_docente,
        "brecha_conectividad": brecha_conectividad,
        "target_riesgo": nivel_riesgo
    })
    
    return df

def explain_student_prediction(model_pipeline, feature_names, student_row):
    """
    Heurística exploratoria: desviación estandarizada absoluta por importancia global.
    NO es una atribución local validada, SHAP, dirección del riesgo ni efecto causal.
    """
    rf_model = model_pipeline.named_steps['classifier']
    importances = rf_model.feature_importances_
    
    # Ponderación local simplificada (Valor normalizado * Importancia global)
    scaler = model_pipeline.named_steps['scaler']
    scaled_values = np.abs(scaler.transform(pd.DataFrame([student_row], columns=feature_names))[0])
    local_impact = scaled_values * importances
    total = np.sum(local_impact)
    local_impact_pct = local_impact / total * 100 if total > 0 else np.zeros_like(local_impact)
    
    explanation = {
        feature: round(float(pct), 1)
        for feature, pct in zip(feature_names, local_impact_pct)
    }
    # Ordenar de mayor a menor impacto
    return dict(sorted(explanation.items(), key=lambda item: item[1], reverse=True))

def main():
    os.makedirs("artifacts", exist_ok=True)
    
    print("[1/4] Generando datos completamente sintéticos, sin alumnos reales...")
    df = generate_anonymized_dataset(n_samples=600)
    df.to_csv("artifacts/dataset_escuela_anonimizado.csv", index=False)
    
    feature_cols = [
        "asistencia_pct",
        "faltas_consecutivas",
        "rendimiento_academico",
        "uso_recursos_profuturo",
        "horas_formacion_docente",
        "brecha_conectividad"
    ]
    
    X = df[feature_cols]
    y = df["target_riesgo"]
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )
    
    print("[2/4] Entrenando Pipeline con Random Forest Interpretable (GridSearch CV)...")
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("classifier", RandomForestClassifier(random_state=42, class_weight="balanced"))
    ])
    
    param_grid = {
        "classifier__n_estimators": [100, 150],
        "classifier__max_depth": [4, 6, 8],
        "classifier__min_samples_leaf": [3, 5]
    }
    
    grid_search = GridSearchCV(
        pipeline, param_grid, cv=5, scoring="f1_weighted", n_jobs=2, return_train_score=True
    )
    grid_search.fit(X_train, y_train)
    best_model = grid_search.best_estimator_
    
    print("[3/4] Evaluando métricas del modelo...")
    y_pred = best_model.predict(X_test)
    
    metrics = {
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "recall_weighted": round(float(recall_score(y_test, y_pred, average="weighted")), 4),
        "f1_weighted": round(float(f1_score(y_test, y_pred, average="weighted")), 4),
        "f1_macro": round(float(f1_score(y_test, y_pred, average="macro")), 4),
        "train_f1_weighted": round(float(f1_score(y_train, best_model.predict(X_train), average="weighted")), 4),
        "cv_f1_weighted": round(float(grid_search.best_score_), 4),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "per_class": classification_report(y_test, y_pred, output_dict=True, zero_division=0),
        "majority_baseline_f1_weighted": round(float(f1_score(y_test, DummyClassifier(strategy="most_frequent").fit(X_train, y_train).predict(X_test), average="weighted")), 4),
        "best_params": grid_search.best_params_
    }
    
    print(f" -> Accuracy: {metrics['accuracy']*100:.1f}%")
    print(f" -> Recall:   {metrics['recall_weighted']*100:.1f}%")
    print(f" -> F1-Score: {metrics['f1_weighted']:.2f}")
    print("\nInforme detallado por nivel de alerta:")
    print(classification_report(y_test, y_pred, target_names=["Bajo (0)", "Medio (1)", "Alto (2)"]))
    
    # Extraer pesos globales de explicabilidad (Feature Importance)
    rf_classifier = best_model.named_steps["classifier"]
    global_importances = {
        col: round(float(imp * 100), 2)
        for col, imp in zip(feature_cols, rf_classifier.feature_importances_)
    }
    
    # Simulación del caso de prueba ALU-8102 para verificar coherencia con el Frontend
    alu_8102_features = [71.0, 4, 4.2, 12.0, 5, 1] # Asistencia 71%, 4 faltas, nota 4.2, uso 12%
    alu_8102_df = pd.DataFrame([alu_8102_features], columns=feature_cols)
    prob_riesgo = best_model.predict_proba(alu_8102_df)[0]
    explicacion_alu_8102 = explain_student_prediction(best_model, feature_cols, alu_8102_features)
    
    print("[4/4] Exportando modelo (.joblib) y reporte de explicabilidad (.json)...")
    joblib.dump(best_model, "artifacts/edupulse_rf_pipeline.joblib")
    
    audit_report = {
        "model_name": "EduPulse Early Warning Random Forest v1.0",
        "data_provenance": "100% synthetic, generated by the included formula with noise; not real educational outcomes.",
        "validation_scope": "Synthetic holdout only. No external, temporal, school-level, fairness or probability-calibration validation. Not connected to the app's inference service.",
        "ethical_design": "Human teacher review required. Fictional sequential identifiers, not hashes. This report does not certify legal compliance.",
        "dataset": {"samples": len(df), "train": len(X_train), "test": len(X_test), "seed": 42, "cv_folds": 5,
                    "class_counts": {str(k): int(v) for k, v in y.value_counts().sort_index().items()},
                    "sha256": hashlib.sha256(df.to_csv(index=False).encode()).hexdigest()},
        "runtime": {"python": platform.python_version(), "numpy": np.__version__, "pandas": pd.__version__, "sklearn": sklearn.__version__, "joblib": joblib.__version__},
        "metrics": metrics,
        "global_feature_importance_pct": global_importances,
        "sample_inference_ALU_8102": {
            "predicted_class": int(best_model.predict(alu_8102_df)[0]),
            "high_risk_probability_pct": round(float(prob_riesgo[2] * 100), 1),
            "heuristic_feature_deviation_pct": explicacion_alu_8102,
            "explanation_limit": "Absolute standardized deviation multiplied by impurity-based global importance. Not SHAP or a validated local explanation."
        }
    }
    
    with open("artifacts/model_audit_report.json", "w", encoding="utf-8") as f:
        json.dump(audit_report, f, indent=4, ensure_ascii=False)
        
    print("Proceso completado. Archivos generados en 'artifacts/'.")

if __name__ == "__main__":
    main()
