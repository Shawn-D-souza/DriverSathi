import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, Alert } from 'react-native';
import { supabase } from '../../lib/supabase'; // Import supabase
import * as Location from 'expo-location';

export default function HomeScreen() {
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  useEffect(() => {
    // This function will run when the component mounts
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('Permission to access location was denied');
        return;
      }
      setLocationStatus('Permission granted!');
    })();
  }, []);

  const requestPermission = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        Alert.alert('Permission Denied', 'You need to grant location permission to use this feature.');
        setLocationStatus('Permission to access location was denied');
    } else {
        setLocationStatus('Permission granted!');
    }
  };


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home Screen</Text>
      <Text style={styles.subtitle}>You are logged in!</Text>

      {/* Location Permission Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>Location Status: {locationStatus}</Text>
        {locationStatus !== 'Permission granted!' && (
            <Button title="Grant Permission" onPress={requestPermission} />
        )}
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
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 20,
  },
  buttonContainer: {
    marginTop: 20,
    width: '60%',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusText: {
    fontSize: 16,
    marginBottom: 10,
  },
});