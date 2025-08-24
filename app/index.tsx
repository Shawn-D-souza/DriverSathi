import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Button,
  Alert,
  AppState,
  Platform,
  ActivityIndicator
} from 'react-native';
import { supabase } from '../lib/supabase';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import * as TaskManager from 'expo-task-manager';
import { useAuth } from '../providers/AuthProvider';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_TASK_NAME = 'background-location-task';
const BUS_ID_STORAGE_KEY = 'background_location_bus_id';

type DriverProfile = {
  bus_id: string;
  name: string;
  is_active: boolean;
  buses: {
    bus_name: string;
    plate_number: string;
  } | null;
};

/**
 * Defines the background task for location tracking.
 * This task retrieves the bus ID from AsyncStorage and uploads the latest location
 * data to the Supabase 'bus_locations' table.
 */
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[DriverSathi BackgroundTask] TaskManager error:', error.message);
    return;
  }
  
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations || locations.length === 0) {
      return; // No location data, do nothing.
    }
    const location = locations[0];
    
    try {
      const busId = await AsyncStorage.getItem(BUS_ID_STORAGE_KEY);
      if (!busId) {
        // This can happen if the task is restarted by the OS after being killed.
        // Stop the task to prevent errors until the user restarts it from the app.
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        return;
      }

      const { error: uploadError } = await supabase.from('bus_locations').upsert({
        bus_id: busId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      }, { onConflict: 'bus_id' });

      if (uploadError) {
        console.error('[DriverSathi BackgroundTask] Supabase upload error:', uploadError.message);
      }

    } catch (e: any) {
      console.error('[DriverSathi BackgroundTask] An unexpected error occurred:', e.message);
    }
  }
});


export default function HomeScreen() {
  const { session } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [locationServicesEnabled, setLocationServicesEnabled] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Checks for location permissions and whether the background task is already running.
   */
  const checkPermissionsAndStatus = useCallback(async () => {
    const { status } = await Location.getBackgroundPermissionsAsync();
    setPermissionStatus(status);

    const providerStatus = await Location.getProviderStatusAsync();
    setLocationServicesEnabled(providerStatus.locationServicesEnabled);

    if (status === 'granted') {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      setIsTracking(hasStarted);
    }
  }, []);

  /**
   * Fetches initial driver data and checks permissions on component mount.
   */
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      if (session) {
        try {
          const { data, error } = await supabase
            .from('drivers')
            .select(`
              bus_id,
              name,
              is_active,
              buses!inner (
                bus_name,
                plate_number
              )
            `)
            .eq('id', session.user.id)
            .single();

          if (error) throw error;
          if (data) setDriver(data as unknown as DriverProfile);

        } catch (error: any) {
          Alert.alert('Error', `Failed to fetch driver data: ${error.message}`);
        }
      }
      await checkPermissionsAndStatus();
      setLoading(false);
    };

    fetchInitialData();
  }, [session, checkPermissionsAndStatus]);

  /**
   * Re-checks permissions when the app becomes active.
   */
  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkPermissionsAndStatus();
      }
    });
    return () => appStateSubscription.remove();
  }, [checkPermissionsAndStatus]);

  /**
   * Requests foreground and background location permissions from the user.
   */
  const requestPermissions = async () => {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      Alert.alert('Permission Denied', 'Foreground location access is required to continue.');
      setPermissionStatus(foregroundStatus);
      return;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      Alert.alert('Permission Denied', 'Background location access must be granted to track location when the app is not active.');
    }
    setPermissionStatus(backgroundStatus);
  };

  /**
   * Starts the background location tracking task.
   */
  const startTracking = async () => {
    if (!driver?.bus_id) {
      Alert.alert("Error", "Cannot start tracking: Driver not assigned to a bus.");
      return;
    }
    if (!driver.is_active) {
      Alert.alert("Account Inactive", "Your account is currently inactive. Please contact an administrator.");
      return;
    }

    try {
      // Persist the busId to AsyncStorage so the background task can access it.
      await AsyncStorage.setItem(BUS_ID_STORAGE_KEY, driver.bus_id);
      
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000, // 1 second
        distanceInterval: 0, // Update regardless of distance
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "DriverSathi is Active",
          notificationBody: "Live location tracking is running.",
          notificationColor: "#3366FF",
        },
      });
      setIsTracking(true);
    } catch (error: any) {
      console.error('Failed to start location updates:', error);
      Alert.alert("Error", `Could not start tracking: ${error.message}`);
    }
  };

  /**
   * Stops the background location tracking task.
   */
  const stopTracking = async () => {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
    // Clean up the stored busId from AsyncStorage.
    await AsyncStorage.removeItem(BUS_ID_STORAGE_KEY);
    setIsTracking(false);
  };

  /**
   * Opens the device's location settings screen.
   */
  const openSettings = () => {
    if (Platform.OS === 'ios') Linking.openURL('app-settings:');
    else Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3366FF" />
      </View>
    );
  }

  const hasAllPermissions = permissionStatus === 'granted' && locationServicesEnabled;
  const canStartTracking = hasAllPermissions && driver?.is_active;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Control Panel</Text>
        <Button title="Sign Out" onPress={() => supabase.auth.signOut()} color="#c0392b" />
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Driver Details</Text>
        {driver ? (
          <>
            <View style={styles.detailRow}>
              <FontAwesome name="user" size={16} style={styles.icon} />
              <Text style={styles.detailText}>Name: {driver.name}</Text>
            </View>
            <View style={styles.detailRow}>
              <FontAwesome name="bus" size={16} style={styles.icon} />
              <Text style={styles.detailText}>Bus: {driver.buses?.bus_name || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <FontAwesome name="vcard" size={16} style={styles.icon} />
              <Text style={styles.detailText}>Plate: {driver.buses?.plate_number || 'N/A'}</Text>
            </View>
             <View style={styles.detailRow}>
              <FontAwesome name={driver.is_active ? 'check-circle' : 'times-circle'} size={16} style={[styles.icon, { color: driver.is_active ? '#4CAF50' : '#F44336' }]} />
              <Text style={styles.detailText}>Status: {driver.is_active ? 'Active' : 'Inactive'}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.infoText}>Could not load driver details.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tracking Status</Text>
        <Text style={[styles.trackingStatus, { color: isTracking ? '#4CAF50' : '#F44336' }]}>
          {isTracking ? 'TRACKING ACTIVE' : 'TRACKING INACTIVE'}
        </Text>
        {!isTracking ? (
          <Button title="Start Tracking" onPress={startTracking} disabled={!canStartTracking} />
        ) : (
          <Button title="Stop Tracking" onPress={stopTracking} color="#F44336" />
        )}
        {!canStartTracking && <Text style={styles.infoText}>Enable permissions and ensure your account is active to start tracking.</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Permissions</Text>
        <View style={styles.permissionRow}>
          <FontAwesome name={permissionStatus === 'granted' ? 'check-circle' : 'times-circle'} size={24} color={permissionStatus === 'granted' ? '#4CAF50' : '#F44336'} />
          <Text style={styles.permissionText}>App Permission</Text>
          {permissionStatus !== 'granted' && <Button title="Grant" onPress={requestPermissions} />}
        </View>
        <View style={styles.permissionRow}>
          <FontAwesome name={locationServicesEnabled ? 'check-circle' : 'times-circle'} size={24} color={locationServicesEnabled ? '#4CAF50' : '#F44336'} />
          <Text style={styles.permissionText}>Device Location</Text>
          {!locationServicesEnabled && <Button title="Turn On" onPress={openSettings} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 20,
        backgroundColor: '#f5f5f5',
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
    },
    card: {
        width: '100%',
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: '600',
      marginBottom: 15,
      color: '#333',
    },
    trackingStatus: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center'
    },
    permissionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    permissionText: {
      flex: 1,
      marginLeft: 15,
      fontSize: 16,
      color: '#333'
    },
    infoText: {
        marginTop: 15,
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    detailText: {
      fontSize: 16,
      color: '#333',
    },
    icon: {
      marginRight: 10,
      width: 20,
      textAlign: 'center',
    },
});