import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Dimensions } from 'react-native';
import { CameraView, Camera } from 'expo-camera'; // import CameraView and Camera

const CAM_HEIGHT = 200;

export default function CameraPreview() {
  const [hasPermission, setHasPermission] = useState(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync(); // still use Camera for permissions
      setHasPermission(status === 'granted');
    })();
  }, []);

  if (hasPermission === null) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }
  if (hasPermission === false) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text>No access to camera</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"          // use "facing" instead of "type"
        ref={cameraRef}
        ratio="16:9"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: CAM_HEIGHT, width: '100%', backgroundColor: '#000' },
  center: { justifyContent: 'center', alignItems: 'center' },
  camera: { flex: 1 },
});