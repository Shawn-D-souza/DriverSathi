import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, Alert, AppState, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';

export default function HomeScreen() {
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [locationServicesEnabled, setLocationServicesEnabled] = useState(true);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  // This function checks both app permission and system-wide location services
  const checkLocationStatus = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setPermissionStatus(status);

    const providerStatus = await Location.getProviderStatusAsync();
    setLocationServicesEnabled(providerStatus.locationServicesEnabled);

    if (status === 'granted' && providerStatus.locationServicesEnabled) {
      // If everything is enabled, get the location
      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    } else {
        // Clear location if permissions are lost
        setLocation(null);
    }
  };

  useEffect(() => {
    // Check status when the app loads
    checkLocationStatus();

    // Add a listener to re-check when the user returns to the app
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkLocationStatus();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const requestPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        Alert.alert('Permission Denied', 'You need to grant location permission to use this feature.');
    }
    // Re-check everything after the request
    checkLocationStatus();
  };

 // Helper to open device settings
const openSettings = () => {
  if (Platform.OS === 'ios') {
    // This URL scheme takes the user to the app's settings on iOS
    Linking.openURL('app-settings:');
  } else {
    // This Intent opens the general location settings on Android
    Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
  }
};


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Location Status</Text>

      {/* App Permission Status */}
      <View style={styles.statusBox}>
        <Text style={styles.statusText}>App Permission:</Text>
        {permissionStatus === 'granted' ? (
          <Text style={[styles.statusValue, styles.granted]}>Granted</Text>
        ) : (
          <>
            <Text style={[styles.statusValue, styles.denied]}>Denied</Text>
            <Button title="Grant App Permission" onPress={requestPermission} />
          </>
        )}
      </View>

      {/* Location Services Status */}
      <View style={styles.statusBox}>
        <Text style={styles.statusText}>Device Location:</Text>
        {locationServicesEnabled ? (
            <Text style={[styles.statusValue, styles.granted]}>On</Text>
        ) : (
            <>
                <Text style={[styles.statusValue, styles.denied]}>Off</Text>
                <Button title="Turn On Location" onPress={openSettings} />
            </>
        )}
      </View>

      {/* Display Location Coordinates */}
      {location ? (
        <View style={styles.locationContainer}>
            <Text style={styles.locationTitle}>Current Location:</Text>
            <Text style={styles.locationText}>
                Latitude: {location.coords.latitude}
            </Text>
            <Text style={styles.locationText}>
                Longitude: {location.coords.longitude}
            </Text>
        </View>
      ) : (
        <Text style={styles.infoText}>Enable both permissions to see your location.</Text>
      )}


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
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    statusBox: {
        width: '90%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 15,
        elevation: 2, // for Android shadow
        shadowColor: '#000', // for iOS shadow
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '500',
    },
    statusValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    granted: {
        color: 'green',
    },
    denied: {
        color: 'red',
    },
    locationContainer: {
        marginTop: 20,
        padding: 15,
        width: '90%',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        backgroundColor: '#fff',
    },
    locationTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 5,
    },
    locationText: {
        fontSize: 16,
    },
    infoText: {
        marginTop: 20,
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    buttonContainer: {
        position: 'absolute',
        bottom: 40,
        width: '60%',
      },
});