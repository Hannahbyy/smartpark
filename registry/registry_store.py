import json
import os
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGISTRY_FILE = os.path.join(BASE_DIR, "registry", "owners.json")

def normalize_plate(plate: str) -> str:
    """Normalize plate: uppercase, remove all whitespace and special characters"""
    if not plate:
        return ""
    return re.sub(r'[^A-Z0-9]', '', plate.upper())

def load_registry():
    """Load registry file or return empty dict"""
    if not os.path.exists(REGISTRY_FILE):
        return {}
    try:
        with open(REGISTRY_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {normalize_plate(k): v for k, v in data.items()}
    except Exception as e:
        print(f"Error reading registry: {e}")
        return {}

def save_registry(data: dict):
    """Save registry to json file with normalized keys"""
    normalized = {normalize_plate(k): v for k, v in data.items()}
    os.makedirs(os.path.dirname(REGISTRY_FILE), exist_ok=True)
    with open(REGISTRY_FILE, "w", encoding="utf-8") as f:
        json.dump(normalized, f, indent=2)

def lookup_owner(plate: str):
    """Lookup owner by normalized plate"""
    clean_plate = normalize_plate(plate)
    registry = load_registry()
    return registry.get(clean_plate)

def add_or_update_owner(plate: str, name: str, phone: str, vehicle_type: str = "car", registered_on: str = None):
    clean_plate = normalize_plate(plate)
    registry = load_registry()
    registry[clean_plate] = {
        "name": name,
        "phone": phone,
        "vehicle_type": vehicle_type,
        "registered_on": registered_on or "2026-01-01"
    }
    save_registry(registry)
    return registry[clean_plate]

def remove_owner(plate: str):
    clean_plate = normalize_plate(plate)
    registry = load_registry()
    if clean_plate in registry:
        del registry[clean_plate]
        save_registry(registry)
        return True
    return False
