from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.ensemble import RandomForestClassifier
import numpy as np
import pickle
import os

app = FastAPI(title="Disaster Prediction AI Service")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request model
class PredictionRequest(BaseModel):
    rainfall: float
    temperature: float
    wind_speed: float
    humidity: float
    history: list = []

# Response model
class PredictionResponse(BaseModel):
    risk_score: float
    disaster_type: str
    confidence: float


def train_model():
    """Train RandomForest with meteorologically accurate disaster thresholds.
    IMD/WMO/NOAA thresholds: flood (heavy rain >64mm), cyclone (wind >62km/h),
    fire (temp>35, hum<35), landslide (rain+slope), drought (low rain, high temp).
    Features: [rainfall mm, temperature °C, wind_speed km/h, humidity %]
    Labels: 0=flood, 1=earthquake, 2=cyclone, 3=fire, 4=landslide, 5=tsunami, 6=drought, 7=safe
    """
    X_train = np.array([
        # Flood (IMD: heavy >64.5mm, very heavy >124.5mm; high humidity)
        [80, 25, 10, 85], [90, 22, 15, 90], [100, 20, 20, 95], [130, 24, 12, 88],
        [70, 28, 8, 80], [85, 24, 12, 88], [65, 26, 10, 82], [45, 22, 6, 85],
        [55, 25, 14, 78], [95, 23, 18, 92],
        # Earthquake (weather-independent; historical)
        [20, 25, 5, 50], [15, 28, 3, 45], [25, 22, 7, 55], [30, 24, 8, 52],
        [10, 27, 4, 48], [18, 26, 6, 54],
        # Cyclone (WMO: gale >62 km/h, storm >88 km/h)
        [60, 28, 65, 75], [50, 30, 72, 70], [55, 27, 68, 80], [40, 29, 90, 68],
        [45, 29, 55, 72], [35, 28, 75, 74], [55, 26, 62, 78],
        # Fire (NFDRS: high temp, low humidity)
        [5, 40, 15, 20], [10, 38, 20, 25], [8, 42, 18, 22], [3, 45, 12, 18],
        [12, 35, 12, 30], [7, 39, 16, 28], [2, 41, 14, 15],
        # Landslide (heavy rain, moderate temp, high humidity)
        [75, 22, 5, 80], [85, 20, 8, 85], [70, 24, 6, 75], [65, 21, 4, 82],
        [55, 19, 7, 78], [80, 23, 5, 88],
        # Tsunami (coastal; weather secondary)
        [30, 26, 25, 60], [25, 28, 30, 65], [20, 27, 28, 58], [35, 25, 22, 62],
        # Drought (IMD: low rain, high temp)
        [5, 35, 10, 30], [8, 38, 12, 25], [10, 40, 15, 28], [3, 42, 8, 22],
        [7, 36, 11, 32], [12, 34, 14, 35],
        # Safe (normal weather)
        [30, 25, 10, 50], [25, 24, 8, 55], [35, 26, 12, 52], [28, 23, 9, 48],
        [32, 27, 11, 53], [22, 26, 6, 58], [38, 24, 14, 50], [26, 28, 7, 54]
    ])

    y_train = np.array([
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  # Flood
        1, 1, 1, 1, 1, 1,  # Earthquake
        2, 2, 2, 2, 2, 2, 2,  # Cyclone
        3, 3, 3, 3, 3, 3, 3,  # Fire
        4, 4, 4, 4, 4, 4,  # Landslide
        5, 5, 5, 5,  # Tsunami
        6, 6, 6, 6, 6, 6,  # Drought
        7, 7, 7, 7, 7, 7, 7, 7  # Safe
    ])

    model = RandomForestClassifier(n_estimators=150, random_state=42, max_depth=8)
    model.fit(X_train, y_train)
    return model


# Initialize model (v2 = meteorologically accurate thresholds)
model_file = 'disaster_model_v2.pkl'
if os.path.exists(model_file):
    with open(model_file, 'rb') as f:
        model = pickle.load(f)
else:
    model = train_model()
    with open(model_file, 'wb') as f:
        pickle.dump(model, f)


def calculate_risk_score(rainfall, temperature, wind_speed, humidity, disaster_type):
    """Calculate risk score using IMD/WMO meteorological thresholds."""
    base_risk = 0
    if disaster_type == 0:  # Flood (IMD: heavy >64mm, very heavy >124mm)
        base_risk = min(98, 35 + (rainfall / 80) * 45 + (humidity - 60) * 0.2)
    elif disaster_type == 1:  # Earthquake (historical; weather-independent)
        base_risk = min(75, 35 + 20)  # Moderate baseline
    elif disaster_type == 2:  # Cyclone (WMO: gale >62, storm >88 km/h)
        base_risk = min(98, 40 + (wind_speed / 80) * 50 + (rainfall / 60) * 10)
    elif disaster_type == 3:  # Fire (high temp + low humidity)
        base_risk = min(98, 45 + (temperature - 30) * 2 + (100 - humidity) * 0.25)
    elif disaster_type == 4:  # Landslide (heavy rain + slope proxy)
        base_risk = min(95, 40 + (rainfall / 70) * 45 + max(0, 25 - abs(temperature - 22)) * 0.5)
    elif disaster_type == 5:  # Tsunami (coastal; historical)
        base_risk = min(80, 45 + 15)
    elif disaster_type == 6:  # Drought (low rain, high temp)
        base_risk = min(95, 40 + (35 - rainfall) * 0.8 + (temperature - 30) * 1.5)
    else:  # Safe
        base_risk = max(0, 15 - rainfall * 0.1 - wind_speed * 0.05)
    return max(0, min(100, base_risk))

disaster_types = ['flood', 'earthquake', 'cyclone', 'fire', 'landslide', 'tsunami', 'drought', 'safe']

@app.get("/")
def read_root():
    return {"message": "Disaster Prediction AI Service", "status": "running"}

@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    """Predict disaster type and risk score"""
    features = np.array([[request.rainfall, request.temperature, request.wind_speed, request.humidity]])
    
    # Predict disaster type
    prediction = model.predict(features)[0]
    probabilities = model.predict_proba(features)[0]
    confidence = float(max(probabilities))
    
    disaster_type = disaster_types[prediction]
    
    # Calculate risk score
    risk_score = calculate_risk_score(
        request.rainfall,
        request.temperature,
        request.wind_speed,
        request.humidity,
        prediction
    )
    
    # If predicted as safe, reduce risk score
    if prediction == 7:
        risk_score = max(0, risk_score - 20)
    
    return PredictionResponse(
        risk_score=round(risk_score, 2),
        disaster_type=disaster_type if disaster_type != 'safe' else 'none',
        confidence=round(confidence * 100, 2)
    )

@app.get("/health")
def health_check():
    return {"status": "healthy", "model": "loaded"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
