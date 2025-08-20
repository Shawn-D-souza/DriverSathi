import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, Alert, AppState, Platform, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import * as TaskManager from 'expo-task-manager';
import { useAuth } from '../providers/AuthProvider';
import { FontAwesome } from '@expo/vector-icons';

const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('TaskManager Error:', error.message);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    if (!location) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('bus_id')
      .eq('id', session.user.id)
      .single();

    if (driverError || !driver) {
      console.error('TaskManager: Could not fetch driver info.');
      return;
    }

    const { error: uploadError } = await supabase.from('bus_locations').upsert({
      bus_id: driver.bus_id,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    }, { onConflict: 'bus_id' });

    if (uploadError) {
      console.error('TaskManager: Failed to upload location.', uploadError.message);
    } else {
      console.log('TaskManager: Location update sent.');
    }
  }
});

export default function HomeScreen() {
  const { session } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [locationServicesEnabled, setLocationServicesEnabled] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [driver, setDriver] = useState<{ bus_id: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const checkPermissionsAndStatus = async () => {
    const { status } = await Location.getBackgroundPermissionsAsync();
    setPermissionStatus(status);

    const providerStatus = await Location.getProviderStatusAsync();
    setLocationServicesEnabled(providerStatus.locationServicesEnabled);

    if (status === 'granted') {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      setIsTracking(hasStarted);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (session) {
      const fetchDriverInfo = async () => {
        const { data, error } = await supabase
          .from('drivers')
          .select('bus_id')
          .eq('id', session.user.id)
          .single();

        if (error) Alert.alert('Error fetching driver data', error.message);
        else if (data) setDriver(data);
      };
      fetchDriverInfo();
      checkPermissionsAndStatus();
    }
  }, [session]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkPermissionsAndStatus();
      }
    });
    return () => appStateSubscription.remove();
  }, []);

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

  const startTracking = async () => {
    if (!driver?.bus_id) {
      Alert.alert("Error", "Cannot start tracking: Driver not assigned to a bus.");
      return;
    }
    setIsTracking(true);
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 500,
      distanceInterval: 0,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "DriverSathi is Active",
        notificationBody: "Live location tracking is running.",
        notificationColor: "#3366FF",
      },
    });
  };

  const stopTracking = async () => {
    setIsTracking(false);
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  };

  const openSettings = () => {
    if (Platform.OS === 'ios') Linking.openURL('app-settings:');
    else Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const hasAllPermissions = permissionStatus === 'granted' && locationServicesEnabled;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Control Panel</Text>
        <Button title="Sign Out" onPress={() => supabase.auth.signOut()} color="#c0392b" />
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tracking Status</Text>
        <Text style={[styles.trackingStatus, { color: isTracking ? '#4CAF50' : '#F44336' }]}>
          {isTracking ? 'TRACKING ACTIVE' : 'TRACKING INACTIVE'}
        </Text>
        {!isTracking ? (
          <Button title="Start Tracking" onPress={startTracking} disabled={!hasAllPermissions} />
        ) : (
          <Button title="Stop Tracking" onPress={stopTracking} color="#F44336" />
        )}
        {!hasAllPermissions && <Text style={styles.infoText}>Enable permissions below to start tracking.</Text>}
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
});