// App.js
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen from './src/screens/LoginScreen';
import PlantsListScreen from './src/screens/PlantsListScreen';
import PlantDetailScreen from './src/screens/PlantsDetailScreen';
import HistoryScreen from './src/screens/HistoryScreen';

const Stack = createStackNavigator();

export default function App() {
  const [userToken, setUserToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      const token = await AsyncStorage.getItem('userToken');
      setUserToken(token);
      setIsLoading(false);
    };
    loadToken();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
          {userToken == null ? (
            <Stack.Screen name="Login" options={{ headerShown: false }}>
              {props => <LoginScreen {...props} setUserToken={setUserToken} />}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="PlantsList" options={{ headerShown: false }}>
                {props => <PlantsListScreen {...props} setUserToken={setUserToken} />}
              </Stack.Screen>
              <Stack.Screen name="PlantDetail" options={{ headerShown: false }}>
                {props => <PlantDetailScreen {...props} setUserToken={setUserToken} />}
              </Stack.Screen>
              <Stack.Screen
                name="History"
                component={HistoryScreen}
                options={({ route }) => ({
                  title: route.params?.sensor ? `${route.params.sensor} History` : 'History',
                })}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}