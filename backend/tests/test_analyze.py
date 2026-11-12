import json
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app


class AnalyzeEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_returns_classifier_prediction_in_analysis_response(self):
        prediction = {
            "condition": "deteriorated",
            "confidence": 0.83,
            "scores": {"healthy": 0.17, "deteriorated": 0.83},
        }
        with patch("api.analyze.predict_health", return_value=prediction) as predict:
            response = self.client.post(
                "/api/analyze",
                data={
                    "species": json.dumps(
                        {
                            "scientificName": "Monstera deliciosa",
                            "commonName": "Monstera",
                            "confirmed": True,
                        }
                    ),
                    "context": json.dumps(
                        {
                            "locationType": "indoor",
                            "light": "indirect",
                            "lastWatered": "2_4_days",
                            "hasDrainage": "yes",
                        }
                    ),
                },
                files=[("images", ("leaf.jpg", b"image bytes", "image/jpeg"))],
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["health"]["status"], "review_needed")
        self.assertEqual(body["health"]["modelPrediction"], prediction)
        self.assertEqual(body["health"]["symptoms"], [])
        self.assertEqual(body["species"]["scientificName"], "Monstera deliciosa")
        predict.assert_called_once_with([b"image bytes"])

    def test_rejects_non_image_upload_types(self):
        response = self.client.post(
            "/api/analyze",
            data={
                "species": json.dumps(
                    {"scientificName": "", "confirmed": False}
                ),
                "context": json.dumps(
                    {
                        "locationType": "unknown",
                        "light": "unknown",
                        "lastWatered": "unknown",
                        "hasDrainage": "unknown",
                    }
                ),
            },
            files=[("images", ("leaf.gif", b"image bytes", "image/gif"))],
        )

        self.assertEqual(response.status_code, 415)
