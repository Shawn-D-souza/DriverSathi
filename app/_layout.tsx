import { Stack } from 'expo-router';
import React from 'react';
import { AuthProvider } from '../providers/AuthProvider'; // Import the provider

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ title: 'Login' }} />
      </Stack>
    </AuthProvider>
  );
}