import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Platform,
    Alert,
    ActivityIndicator,
    StyleSheet,
    PermissionsAndroid
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, Region } from 'react-native-maps';
import axios from 'axios';

type LocationState = Location.LocationObject | null;

interface LocationError {
    message: string;
    type: 'error' | 'warning';
}

export default function LocationApp() {
    const [location, setLocation] = useState<LocationState>(null);
    const [errorMsg, setErrorMsg] = useState<LocationError | null>(null);
    const [mapRegion, setMapRegion] = useState<Region | undefined>(undefined);
    const [loading, setLoading] = useState<boolean>(true);
    const [retryCount, setRetryCount] = useState<number>(0);
    const MAX_RETRIES = 3;

    useEffect(() => {
        const ws = new WebSocket('wss://wss.clusterider.tech');

        ws.onopen = () => {
            console.log('Connected to WebSocket server');
        };

        ws.onmessage = async () => {
            console.log('Message received from server');
            // Now that location is available, send the data to the server
            sendLocationToServer();
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            Alert.alert('WebSocket Error', 'An error occurred while connecting to the server.');
        };

        ws.onclose = () => {
            console.log('Disconnected from WebSocket server');
        };

        return () => ws.close();
    }, []);

    const requestAndroidPermission = async () => {
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                {
                    title: "Location Permission",
                    message: "This app needs access to your location to function properly.",
                    buttonNeutral: "Ask Me Later",
                    buttonNegative: "Cancel",
                    buttonPositive: "OK"
                }
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            console.warn('Error requesting Android permission:', err);
            return false;
        }
    };

    const checkLocationServices = async () => {
        try {
            const enabled = await Location.hasServicesEnabledAsync();
            if (!enabled) {
                setErrorMsg({
                    message: 'Location services are disabled. Please enable them in your device settings.',
                    type: 'warning'
                });
                return false;
            }
            return true;
        } catch (error) {
            console.error('Error checking location services:', error);
            return false;
        }
    };

    const getCurrentLocation = async (): Promise<boolean> => {
        setLoading(true);
        setErrorMsg(null);

        try {
            const servicesEnabled = await checkLocationServices();
            if (!servicesEnabled) return false;

            let hasPermission = false;
            if (Platform.OS === 'android') {
                hasPermission = await requestAndroidPermission();
            } else {
                const { status } = await Location.requestForegroundPermissionsAsync();
                hasPermission = status === 'granted';
            }

            if (!hasPermission) {
                setErrorMsg({
                    message: 'Location permission denied. Please enable it in app settings.',
                    type: 'error'
                });
                return false;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            setLocation(location);
            setMapRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            });
            setRetryCount(0);
            return true;
        } catch (error) {
            console.error('Error getting location:', error);
            if (retryCount < MAX_RETRIES) {
                setRetryCount(prev => prev + 1);
                setTimeout(getCurrentLocation, 2000);
            } else {
                // @ts-ignore
                setErrorMsg({ message: `Failed to get location: ${error.message}`, type: 'error' });
                Alert.alert('Location Error', 'Unable to get your location. Please try again.');
            }
            return false;
        } finally {
            setLoading(false);
        }
    };

    const sendLocationToServer = async () => {
        if (!location) {
            Alert.alert('Error', 'Location data is not available. Please refresh your location.');
            return;
        }

        try {
            const { latitude, longitude } = location.coords;
            const response = await axios.post('https://wss.clusterider.tech/send-location', {
                lat: latitude,
                long: longitude
            });

            if (response.data.success) {
                Alert.alert('Success', 'Location shared successfully via server.');
            } else {
                Alert.alert('Failed', 'Failed to send location via server. Please try again.');
            }
        } catch (error) {
            console.error('Error sending location to server:', error);
            Alert.alert('Error', 'Failed to send location to server. Please try again.');
        }
    };

    useEffect(() => {
        getCurrentLocation();
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.mainContainer}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Location Sharing</Text>
                    <View style={styles.userIcon}>
                        <Text style={styles.userIconText}>U</Text>
                    </View>
                </View>

                {/* Main Content */}
                <View style={styles.content}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#3B82F6" />
                            <Text style={styles.loadingText}>Fetching location...</Text>
                        </View>
                    ) : (
                        <>
                            {/* Coordinates Display */}
                            <View style={styles.coordinatesContainer}>
                                <View style={styles.coordinateBox}>
                                    <Text style={styles.coordinateLabel}>Latitude</Text>
                                    <TextInput
                                        style={styles.coordinateInput}
                                        value={location?.coords.latitude.toString() || ''}
                                        editable={false}
                                    />
                                </View>
                                <View style={styles.coordinateBox}>
                                    <Text style={styles.coordinateLabel}>Longitude</Text>
                                    <TextInput
                                        style={styles.coordinateInput}
                                        value={location?.coords.longitude.toString() || ''}
                                        editable={false}
                                    />
                                </View>
                            </View>

                            {/* Map View */}
                            {mapRegion ? (
                                <MapView
                                    style={styles.map}
                                    region={mapRegion}
                                    showsUserLocation={true}
                                >
                                    <Marker
                                        coordinate={{
                                            latitude: mapRegion.latitude,
                                            longitude: mapRegion.longitude,
                                        }}
                                        title="Your Location"
                                    />
                                </MapView>
                            ) : (
                                <View style={styles.mapPlaceholder}>
                                    <Feather name="map-pin" size={48} color="#9CA3AF" />
                                    <Text style={styles.mapPlaceholderText}>Map loading...</Text>
                                </View>
                            )}
                        </>
                    )}
                </View>

                {/* Action Buttons */}
                <TouchableOpacity
                    style={[styles.floatingButton, styles.refreshButton]}
                    activeOpacity={0.7}
                    onPress={getCurrentLocation}
                >
                    <Feather name="refresh-cw" size={24} color="white" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.floatingButton, styles.sendButton]}
                    activeOpacity={0.7}
                    onPress={() => sendLocationToServer()}
                    disabled={!location} // Disable if location is not available
                >
                    <Feather name="send" size={24} color={location ? "white" : "#9CA3AF"} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    mainContainer: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    userIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    userIconText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#4B5563',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    coordinatesContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    coordinateBox: {
        flex: 1,
        marginHorizontal: 4,
    },
    coordinateLabel: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 4,
    },
    coordinateInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 8,
        backgroundColor: '#F9FAFB',
    },
    map: {
        flex: 1,
        borderRadius: 8,
    },
    mapPlaceholder: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mapPlaceholderText: {
        color: '#9CA3AF',
        marginTop: 8,
    },
    floatingButton: {
        position: 'absolute',
        right: 24,
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    refreshButton: {
        bottom: 100,
        backgroundColor: '#10B981',
    },
    sendButton: {
        bottom: 24,
        backgroundColor: '#3B82F6',
    },
});
