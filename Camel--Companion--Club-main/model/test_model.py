"""Offline tests with synthetic fixtures only; no supplied pickle is loaded."""
import unittest
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from train_model import generate_anonymized_dataset, explain_student_prediction


class SyntheticModelTests(unittest.TestCase):
    def test_reproducible_bounded_synthetic_data_without_global_rng_changes(self):
        np.random.seed(123)
        state = np.random.get_state()
        first = generate_anonymized_dataset(100)
        second = generate_anonymized_dataset(100)
        pd.testing.assert_frame_equal(first, second)
        self.assertTrue(np.array_equal(state[1], np.random.get_state()[1]))
        self.assertTrue(first['student_id_hash'].is_unique)
        self.assertTrue(first['asistencia_pct'].between(0, 100).all())
        self.assertTrue(first['rendimiento_academico'].between(0, 10).all())
        self.assertTrue(first['target_riesgo'].isin([0, 1, 2]).all())

    def test_zero_deviation_does_not_produce_nan_or_fake_local_attributions(self):
        columns = ['a', 'b']
        frame = pd.DataFrame([[0, 0], [2, 2]], columns=columns)
        pipeline = Pipeline([('scaler', StandardScaler()),
                             ('classifier', RandomForestClassifier(n_estimators=5, random_state=42))])
        pipeline.fit(frame, [0, 1])
        result = explain_student_prediction(pipeline, columns, [1, 1])
        self.assertEqual(result, {'a': 0.0, 'b': 0.0})


if __name__ == '__main__':
    unittest.main()
