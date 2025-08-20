import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button, Alert, AppState, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { useAuth } from '../../providers/AuthProvider';

export default function HomeScreen() {
  const { session } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [locationServicesEnabled, setLocationServicesEnabled] = useState(true);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [driver, setDriver] = useState<{ bus_id: string } | null>(null);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (session) {
      const fetchDriverInfo = async () => {
        const { data, error } = await supabase
          .from('drivers')
          .select('bus_id')
          .eq('id', session.user.id)
          .single();

        if (error) {
          Alert.alert('Error fetching driver data', error.message);
        } else if (data) {
          setDriver(data);
        }
      };
      fetchDriverInfo();
    }
  }, [session]);


  const checkLocationStatus = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setPermissionStatus(status);
    const providerStatus = await Location.getProviderStatusAsync();
    setLocationServicesEnabled(providerStatus.locationServicesEnabled);
    return { hasPermissions: status === 'granted', servicesEnabled: providerStatus.locationServicesEnabled };
  };

  const startTracking = async () => {
    const { hasPermissions, servicesEnabled } = await checkLocationStatus();
    if (!hasPermissions || !servicesEnabled) {
      Alert.alert("Cannot Start Tracking", "Please grant location permissions and enable device location services.");
      return;
    }
    if (!session?.user) {
      Alert.alert("Error", "You must be logged in to start tracking.");
      return;
    }
    if (!driver?.bus_id) {
      Alert.alert("Error", "You are not assigned to a bus. Please contact support.");
      return;
    }

    setIsTracking(true);
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 500,
        distanceInterval: 1,
      },
      async (newLocation) => {
        setLocation(newLocation);

        const { error } = await supabase.from('bus_locations').upsert({
          bus_id: driver.bus_id,
          latitude: newLocation.coords.latitude,
          longitude: newLocation.coords.longitude,
        }, {
          onConflict: 'bus_id'
        });

        if (error) {
          console.error('Error uploading location:', error.message);
          setLastSync('Error');
        } else {
          setLastSync(new Date().toLocaleTimeString());
          console.log('Location uploaded successfully');
        }
      }
    );
  };

  const stopTracking = () => {
    setIsTracking(false);
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  };

  useEffect(() => {
    checkLocationStatus();
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') checkLocationStatus();
    });
    return () => {
      appStateSubscription.remove();
      stopTracking();
    };
  }, []);

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
    }
  };

  const hasAllPermissions = permissionStatus === 'granted' && locationServicesEnabled;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Driver Control Panel</Text>
      <View style={styles.trackingContainer}>
        <Text style={[styles.trackingStatus, { color: isTracking ? 'green' : 'red' }]}>
          {isTracking ? 'TRACKING ACTIVE' : 'TRACKING INACTIVE'}
        </Text>
        {!isTracking ? (
          <Button title="Start Tracking" onPress={startTracking} disabled={!hasAllPermissions} />
        ) : (
          <Button title="Stop Tracking" onPress={stopTracking} color="red" />
        )}
        {!hasAllPermissions && <Text style={styles.infoText}>Enable permissions below to start tracking.</Text>}
      </View>

      {location && (
        <View style={styles.locationContainer}>
          <Text style={styles.locationTitle}>Live Data:</Text>
          <Text style={styles.locationText}>Latitude: {location.coords.latitude.toFixed(5)}</Text>
          <Text style={styles.locationText}>Longitude: {location.coords.longitude.toFixed(5)}</Text>
          {lastSync && <Text style={styles.syncText}>Last Sync: {lastSync}</Text>}
        </View>
      )}

      <View style={styles.permissionsContainer}>
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>App Permission:</Text>
          {permissionStatus === 'granted' ? <Text style={[styles.statusValue, styles.granted]}>Granted</Text> : <Button title="Grant" onPress={() => Location.requestForegroundPermissionsAsync().then(checkLocationStatus)} />}
        </View>
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>Device Location:</Text>
          {locationServicesEnabled ? <Text style={[styles.statusValue, styles.granted]}>On</Text> : <Button title="Turn On" onPress={openSettings} />}
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <Button title="Sign Out" onPress={() => supabase.auth.signOut()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 60,
        paddingHorizontal: 20,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    trackingContainer: {
        width: '100%',
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    trackingStatus: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    locationContainer: {
        width: '100%',
        padding: 15,
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    locationTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 5,
    },
    locationText: {
        fontSize: 16,
        marginBottom: 5,
    },
    syncText: {
        fontSize: 14,
        color: '#888',
        marginTop: 10,
        fontStyle: 'italic',
    },
    permissionsContainer: {
        width: '100%',
        marginTop: 'auto',
        marginBottom: 100,
    },
    statusBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    statusText: {
        fontSize: 16,
    },
    statusValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    granted: {
        color: 'green',
    },
    infoText: {
        marginTop: 10,
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    buttonContainer: {
        position: 'absolute',
        bottom: 40,
        width: '90%',
    },
});