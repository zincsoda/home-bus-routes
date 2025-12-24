import requests
import json
from datetime import datetime

class KMBTracker:
    def __init__(self):
        self.base_url = "https://data.etabus.gov.hk/v1/transport/kmb"

    def get_stop_id(self, route, stop_name_en, direction_dest):
        """
        Finds the Stop ID for a specific route and stop name.
        direction_dest: The destination name (e.g., 'Sheung Shui') to filter direction.
        """
        # Try both directions (outbound and inbound) and service type 1 (regular service)
        directions = ['outbound', 'inbound']
        service_type = 1  # Regular service
        
        print(f"Searching for stop '{stop_name_en}' on route {route}...")
        found_stops = []
        
        # Query route-stop for each direction
        for direction in directions:
            url = f"{self.base_url}/route-stop/{route}/{direction}/{service_type}"
            print(f"Checking {direction} direction...")
            
            try:
                response = requests.get(url)
                if response.status_code == 200:
                    data = response.json()
                    
                    # Search for the stop in this direction
                    for stop in data.get('data', []):
                        stop_detail = self.get_stop_name_by_id(stop['stop'])
                        
                        if stop_detail and stop_name_en.lower() in stop_detail['name_en'].lower():
                            found_stops.append({
                                'stop_id': stop['stop'],
                                'direction': stop.get('bound', 'O' if direction == 'outbound' else 'I'),
                                'seq': stop.get('seq'),
                                'name': stop_detail['name_en'],
                                'service_type': service_type
                            })
                elif response.status_code == 404:
                    # This direction doesn't exist for this route, skip it
                    continue
            except requests.exceptions.RequestException as e:
                # Continue to next direction if this one fails
                continue

        if not found_stops:
            print(f"Could not find stop '{stop_name_en}' on route {route}")
            return None, None

        print(f"Found {len(found_stops)} matching stop(s). Verifying destination...")

        # Determine which of the found stops is heading to the destination
        # We check the ETA for the found stops. The ETA result contains the "dest_en" field.
        for stop_candidate in found_stops:
            eta_data = self.get_eta(stop_candidate['stop_id'], route)
            if eta_data:
                # Check the first entry to see the destination
                for bus in eta_data:
                    if bus.get('dest_en', '').lower() == direction_dest.lower():
                        return stop_candidate['stop_id'], stop_candidate['direction']
        
        # If we found stops but couldn't verify destination, return the first one
        # (This might happen if there's no ETA data available)
        if found_stops:
            print(f"Warning: Could not verify destination from ETA data. Using first match.")
            return found_stops[0]['stop_id'], found_stops[0]['direction']
        
        return None, None

    def get_stop_name_by_id(self, stop_id):
        """Fetches the English and Chinese name of a stop by ID."""
        url = f"{self.base_url}/stop/{stop_id}"
        try:
            response = requests.get(url)
            if response.status_code == 200:
                return response.json()['data']
        except:
            pass
        return None

    def get_eta(self, stop_id, route):
        """Fetches the ETA data."""
        url = f"{self.base_url}/eta/{stop_id}/{route}/1" # 1 is usually main service
        try:
            response = requests.get(url)
            if response.status_code == 200:
                return response.json()['data']
        except Exception as e:
            print(f"Error fetching ETA: {e}")
        return []

def main():
    route = "77K"
    my_stop = "Wang Toi Shan"
    destination = "Sheung Shui"

    print(f"--- Searching for {route} at {my_stop} towards {destination} ---")
    
    tracker = KMBTracker()
    
    # Step 1 & 2: Locate the Stop ID and correct Direction
    stop_id, direction = tracker.get_stop_id(route, my_stop, destination)

    if not stop_id:
        print("Could not find the stop or determine the correct direction.")
        return

    print(f"Found Stop ID: {stop_id} (Direction: {direction})")

    # Step 3: Get Real-time ETA
    eta_data = tracker.get_eta(stop_id, route)
    
    print(f"\nUPCOMING BUSES FOR {route} TO {destination.upper()}:")
    print("-" * 40)
    
    count = 0
    for bus in eta_data:
        # Filter by the direction we found earlier to ensure we don't show buses going the wrong way
        # (Though querying by stop_id usually isolates this, some stops are shared).
        if bus['dir'] == direction and bus['dest_en'].lower() == destination.lower():
            timestamp_str = bus['eta']
            
            if timestamp_str:
                # Parse timestamp
                dt_object = datetime.fromisoformat(timestamp_str)
                time_display = dt_object.strftime("%H:%M:%S")
                
                # Calculate minutes remaining
                now = datetime.now(dt_object.tzinfo)
                minutes_left = int((dt_object - now).total_seconds() / 60)
                
                if minutes_left < 0:
                    status = "Departed"
                elif minutes_left == 0:
                    status = "Arriving Now"
                else:
                    status = f"{minutes_left} min"
                
                print(f"Time: {time_display} | Status: {status}")
                count += 1
            else:
                print("No scheduled time available (Check remarks).")

    if count == 0:
        print("No upcoming buses found in the immediate schedule.")

if __name__ == "__main__":
    main()

