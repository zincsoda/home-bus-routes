import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import routeConfig from './routes.json';
import './App.css';

const KMB_BASE_URL = 'https://data.etabus.gov.hk/v1/transport/kmb';

// Route configuration loaded from routes.json
const ROUTE_CONFIG = routeConfig;

const ROUTE_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#ea580c'];

function App() {
  const [busRoutes, setBusRoutes] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const stopIdCache = useRef(new Map());

  // Get stop name by ID
  const getStopNameById = useCallback(async (stopId) => {
    try {
      const response = await axios.get(`${KMB_BASE_URL}/stop/${stopId}`);
      // Debug logging - uncomment to enable
      // console.log(`[getStopNameById] Response for stop ${stopId}:`, response.data);
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching stop name for ${stopId}:`, error.message);
      return null;
    }
  }, []);

  // Get ETA data
  const getETA = useCallback(async (stopId, route, serviceType = 1, routeId = null) => {
    try {
      const url = `${KMB_BASE_URL}/eta/${stopId}/${route}/${serviceType}`;
      const response = await axios.get(url);
      // Debug logging - uncomment to enable
      // if (routeId === 4) {
      //   console.log(`[getETA] Response for stop ${stopId}, route ${route}:`, response.data);
      //   if (response.data && response.data.data) {
      //     console.log(`[getETA] Data array (${response.data.data.length} items):`, response.data.data);
      //     if (response.data.data.length > 0) {
      //       console.table(response.data.data);
      //       response.data.data.forEach((item, index) => {
      //         console.log(`[getETA] Item ${index} details:`, JSON.stringify(item, null, 2));
      //       });
      //     }
      //   }
      // }
      if (response.status === 200) {
        return response.data.data || [];
      }
    } catch (error) {
      // Debug logging - uncomment to enable
      // if (routeId === 4) {
      //   console.error(`Error fetching ETA for stop ${stopId}, route ${route}:`, error.message);
      // }
    }
    return [];
  }, []);

  // Find stop ID for a route, stop name, and destination
  const findStopId = useCallback(async (route, stopNameEn, directionDest) => {
    const cacheKey = `${route}-${stopNameEn}-${directionDest}`;
    if (stopIdCache.current.has(cacheKey)) {
      return stopIdCache.current.get(cacheKey);
    }

    const directions = ['outbound', 'inbound'];
    const serviceType = 1;
    const foundStops = [];

    for (const direction of directions) {
      try {
        const url = `${KMB_BASE_URL}/route-stop/${route}/${direction}/${serviceType}`;
        const response = await axios.get(url);
        // Debug logging - uncomment to enable
        // console.log(`[findStopId] Response for route ${route}, ${direction}:`, response.data);
        
        if (response.status === 200) {
          const data = response.data;
          
          for (const stop of data.data || []) {
            const stopDetail = await getStopNameById(stop.stop);
            
            if (stopDetail && stopNameEn.toLowerCase().includes(stopDetail.name_en.toLowerCase())) {
              foundStops.push({
                stop_id: stop.stop,
                direction: stop.bound || (direction === 'outbound' ? 'O' : 'I'),
                seq: stop.seq,
                name: stopDetail.name_en,
                service_type: serviceType
              });
            }
          }
        }
      } catch (error) {
        if (error.response?.status !== 404) {
          console.error(`Error checking ${direction} for route ${route}:`, error.message);
        }
        continue;
      }
    }

    if (foundStops.length === 0) {
      return null;
    }

    // Verify destination by checking ETA
    for (const stopCandidate of foundStops) {
      try {
        const etaData = await getETA(stopCandidate.stop_id, route);
        if (etaData && etaData.length > 0) {
          for (const bus of etaData) {
            if (bus.dest_en && bus.dest_en.toLowerCase() === directionDest.toLowerCase()) {
              const result = { stopId: stopCandidate.stop_id, direction: stopCandidate.direction };
              stopIdCache.current.set(cacheKey, result);
              return result;
            }
          }
        }
      } catch (error) {
        continue;
      }
    }

    // If we found stops but couldn't verify, use the first one
    if (foundStops.length > 0) {
      const result = { stopId: foundStops[0].stop_id, direction: foundStops[0].direction };
      stopIdCache.current.set(cacheKey, result);
      return result;
    }

    return null;
  }, [getETA, getStopNameById]);

  // Format ETA timestamp
  const formatETA = (etaTimestamp) => {
    if (!etaTimestamp) return null;
    
    const etaDate = new Date(etaTimestamp);
    const now = new Date();
    const diffMs = etaDate - now;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 0) {
      return 'Departed';
    } else if (diffMins === 0) {
      return 'Arriving Now';
    } else {
      return `${diffMins} min`;
    }
  };

  // Fetch bus route data
  const fetchBusRoutes = useCallback(async () => {
    try {
      const routesData = await Promise.all(
        ROUTE_CONFIG.map(async (config) => {
          try {
            // Use stop_id from config if provided, otherwise look it up
            let stopId, direction, serviceType;
            
            // Convert bound (inbound/outbound) to direction code (I/O) if provided
            if (config.bound) {
              direction = config.bound.toLowerCase() === 'inbound' ? 'I' : 'O';
            } else if (config.direction) {
              direction = config.direction;
            }
            
            if (config.stop_id && direction) {
              // Use direct configuration
              stopId = config.stop_id;
              serviceType = config.service_type || 1;
            } else {
              // Fall back to lookup
              const stopInfo = await findStopId(config.route, config.stopName, config.destination);
              
              if (!stopInfo) {
                return {
                  id: config.id,
                  routeNumber: config.route,
                  routeName: config.routeName,
                  stopName: config.stopName,
                  nextArrivals: ['No upcoming buses'],
                  color: ROUTE_COLORS[(config.id - 1) % ROUTE_COLORS.length],
                  error: `Could not find stop "${config.stopName}" for route ${config.route}`
                };
              }
              
              stopId = stopInfo.stopId;
              direction = stopInfo.direction;
              serviceType = config.service_type || 1;
            }

            const etaData = await getETA(stopId, config.route, serviceType, config.id);
            
            // Debug logging - uncomment to enable (change routeId to the route you want to debug)
            // if (config.id === 4) {
            //   console.log(`[fetchBusRoutes] Route ${config.route} (ID: ${config.id}), stop ${stopId}:`);
            //   console.log(`  - Expected direction: ${direction}, destination: ${config.destination}`);
            //   console.log(`  - ETA data received:`, etaData);
            //   console.log(`  - ETA data directions:`, etaData.map(bus => ({ dir: bus.dir, dest_en: bus.dest_en })));
            // }
            
            const filteredETAs = etaData
              .filter(bus => {
                const dirMatch = bus.dir === direction;
                // More flexible destination matching: check if either contains the other
                const busDestLower = bus.dest_en ? bus.dest_en.toLowerCase() : '';
                const configDestLower = config.destination.toLowerCase();
                const destMatch = busDestLower && (
                  busDestLower === configDestLower ||
                  busDestLower.includes(configDestLower) ||
                  configDestLower.includes(busDestLower)
                );
                // Debug logging - uncomment to enable (change routeId to the route you want to debug)
                // if (config.id === 4) {
                //   console.log(`  - Bus filter: dir=${bus.dir} (expected ${direction}) -> ${dirMatch}, dest=${bus.dest_en} (expected ${config.destination}) -> ${destMatch}`);
                // }
                return dirMatch && destMatch;
              })
              .slice(0, 3) // Get first 3 arrivals
              .map(bus => formatETA(bus.eta))
              .filter(time => time !== null);
            
            // Debug logging - uncomment to enable (change routeId to the route you want to debug)
            // if (config.id === 4) {
            //   console.log(`  - Filtered ETAs:`, filteredETAs);
            // }

            return {
              id: config.id,
              routeNumber: config.route,
              routeName: config.routeName,
              stopName: config.stopName,
              nextArrivals: filteredETAs.length > 0 ? filteredETAs : ['No upcoming buses'],
              color: ROUTE_COLORS[(config.id - 1) % ROUTE_COLORS.length]
            };
          } catch (error) {
            console.error(`Error fetching data for route ${config.route}:`, error);
            return {
              id: config.id,
              routeNumber: config.route,
              routeName: config.routeName,
              stopName: config.stopName,
              nextArrivals: ['Error loading data'],
              color: ROUTE_COLORS[(config.id - 1) % ROUTE_COLORS.length],
              error: error.message
            };
          }
        })
      );

      setBusRoutes(routesData);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Error fetching bus routes:', error);
      setLoading(false);
      setLastUpdated(new Date());
      // Set error state routes
      setBusRoutes(ROUTE_CONFIG.map((config, index) => ({
        id: config.id,
        routeNumber: config.route,
        routeName: config.routeName,
        stopName: config.stopName,
        nextArrivals: ['Error loading'],
        color: ROUTE_COLORS[index]
      })));
    }
  }, [findStopId, getETA]);

  // Update current time every second
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  // Fetch bus data on mount and every 1 minute
  useEffect(() => {
    fetchBusRoutes();
    const interval = setInterval(() => {
      fetchBusRoutes();
    }, 60000); // Update every 1 minute

    return () => clearInterval(interval);
  }, [fetchBusRoutes]);

  if (loading) {
    return (
      <div className="App">
        <div className="signage-container">
          <div style={{ textAlign: 'center', padding: '50px', color: 'rgba(255, 255, 255, 0.8)' }}>
            Loading bus routes...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="signage-container">
        <header className="signage-header">
          <div className="signage-time-container">
            <div className="signage-time">Current Time: {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            {lastUpdated && (
              <div className="signage-last-updated">• Last Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            )}
          </div>
        </header>
        
        <div className="routes-grid">
          {busRoutes.map((route) => (
            <div key={route.id} className="route-card" style={{ borderLeftColor: route.color }}>
              <div className="route-header">
                <div className="route-number" style={{ backgroundColor: route.color }}>
                  {route.routeNumber}
                </div>
                <div className="route-name-container">
                  <div className="route-name">{route.routeName}</div>
                  {route.stopName && (
                    <div className="route-stop-name">{route.stopName}</div>
                  )}
                </div>
              </div>
              
              <div className="arrivals-list">
                {route.nextArrivals && route.nextArrivals.length > 0 ? (
                  route.nextArrivals.slice(0, 3).map((arrival, index) => (
                    <div key={index} className="arrival-item">
                      <span className="arrival-time">{arrival}</span>
                      {index === 0 && arrival !== 'No upcoming buses' && !arrival.includes('Error') && <span className="arrival-badge">Next</span>}
                    </div>
                  ))
                ) : (
                  <div className="arrival-item">
                    <span className="arrival-time">No data available</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
