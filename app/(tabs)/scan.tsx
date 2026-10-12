
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  Pressable,
  StatusBar,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { registerAttendance } from '@/lib/attendance';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [lastData, setLastData] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const { user } = useAuth();

  // Animated scanner line
  const scanLinePosition = useRef(new Animated.Value(0)).current;
  const scanAnimation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!scanned && permission?.granted) {
      scanLinePosition.setValue(0);

      scanAnimation.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLinePosition, {
            toValue: 1,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scanLinePosition, {
            toValue: 0,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      scanAnimation.current.start();
    } else {
      scanAnimation.current?.stop();
    }

    return () => {
      scanAnimation.current?.stop();
    };
  }, [scanned, permission?.granted, scanLinePosition]);

  const animatedLineTranslateY = scanLinePosition.interpolate({
    inputRange: [0, 1],
    outputRange: [-75, 75],
  });

  const handleBarcodeScanned = async ({
    data,
  }: {
    data: string;
  }) => {
    if (scanned || loading) return;

    setScanned(true);
    setLastData(data);
    setMessage(null);
    setLoading(true);

    try {
      if (!user?.id) {
        setSuccess(false);
        setMessage('Please sign in before recording attendance.');
        return;
      }

      const result = await registerAttendance(data, user.id);

      setMessage(result.message);
      setSuccess(result.success);
    } catch {
      setSuccess(false);
      setMessage('Something went wrong. Please try scanning again.');
    } finally {
      setLoading(false);
    }
  };

  const handleScanAgain = () => {
    setScanned(false);
    setLastData(null);
    setMessage(null);
    setSuccess(false);
    setLoading(false);
  };

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.permissionSubtitle}>
          Preparing your camera...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionIcon}>
          <Ionicons
            name="camera-outline"
            size={42}
            color={COLORS.primary}
          />
        </View>

        <Text style={styles.permissionTitle}>
          Camera Access Needed
        </Text>

        <Text style={styles.permissionSubtitle}>
          Allow camera access to scan school event QR codes and record
          your attendance.
        </Text>

        <View style={styles.permissionButton}>
          <AppButton
            theme="primary"
            title="Enable Camera"
            icon="camera"
            onPress={requestPermission}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={
          scanned || loading ? undefined : handleBarcodeScanned
        }
      />

      {/* Dark camera overlay */}
      <View style={styles.darkOverlay} />

      {/* Top heading */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons
            name="qr-code-outline"
            size={24}
            color="#FFFFFF"
          />
        </View>

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Scan Attendance</Text>
          <Text style={styles.headerSubtitle}>
            School Event Attendance
          </Text>
        </View>

        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Scanner area */}
      <View style={styles.scannerArea}>
        <Text style={styles.scanInstruction}>
          {scanned
            ? 'QR CODE DETECTED'
            : 'ALIGN QR CODE WITHIN FRAME'}
        </Text>

        <View style={styles.scannerFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />

          {!scanned && (
            <View style={styles.qrPlaceholder}>
              <Ionicons
                name="qr-code-outline"
                size={76}
                color="rgba(255,255,255,0.85)"
              />

              {/* Animated scanning line */}
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    transform: [
                      { translateY: animatedLineTranslateY },
                    ],
                  },
                ]}
              />
            </View>
          )}

          {scanned && (
            <View style={styles.detectedIcon}>
              <Ionicons
                name="checkmark-circle"
                size={66}
                color="#FFFFFF"
              />
            </View>
          )}
        </View>

        <Text style={styles.helperText}>
          {scanned
            ? 'Your QR code has been captured.'
            : 'Keep your camera steady and make sure the QR code is clearly visible.'}
        </Text>
      </View>

      {/* Bottom information card */}
      <View style={styles.bottomCard}>
        {!scanned ? (
          <>
            <View style={styles.cardHeadingRow}>
              <View style={styles.cardIcon}>
                <Ionicons
                  name="scan-outline"
                  size={23}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>
                  Ready to check in?
                </Text>
                <Text style={styles.cardSubtitle}>
                  Scan the QR code provided by your teacher.
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.tipRow}>
              <Ionicons
                name="sunny-outline"
                size={19}
                color={COLORS.primary}
              />
              <Text style={styles.tipText}>
                Tip: Make sure there is enough light to scan clearly.
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.resultHeading}>
              <View
                style={[
                  styles.resultIcon,
                  success
                    ? styles.successBackground
                    : styles.errorBackground,
                ]}
              >
                <Ionicons
                  name={
                    loading
                      ? 'time-outline'
                      : success
                        ? 'checkmark-circle'
                        : 'alert-circle'
                  }
                  size={27}
                  color={
                    loading
                      ? COLORS.primary
                      : success
                        ? '#2E7D32'
                        : '#C62828'
                  }
                />
              </View>

              <View style={styles.resultTextContainer}>
                <Text style={styles.resultTitle}>
                  {loading
                    ? 'Recording attendance...'
                    : success
                      ? 'Attendance Confirmed!'
                      : 'Unable to Check In'}
                </Text>

                <Text style={styles.resultSubtitle}>
                  {loading
                    ? 'Please wait while we process your scan.'
                    : message}
                </Text>
              </View>
            </View>

            {loading && (
              <ActivityIndicator
                size="small"
                color={COLORS.primary}
                style={styles.loader}
              />
            )}

            {!loading && (
              <View style={styles.buttonContainer}>
                <AppButton
                  theme="primary"
                  title="Scan Again"
                  icon="refresh"
                  onPress={handleScanAgain}
                />
              </View>
            )}

            {!loading && !success && (
              <Text style={styles.retryHint}>
                Check the QR code and try again if needed.
              </Text>
            )}

            {success && (
              <View style={styles.confirmationNote}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={17}
                  color="#2E7D32"
                />
                <Text style={styles.confirmationText}>
                  Your attendance has been saved.
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#211B18',
  },

  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22, 16, 13, 0.52)',
  },

  header: {
    position: 'absolute',
    top: 24,
    left: 22,
    right: 22,
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: 'rgba(191, 141, 97, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 3,
  },

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#7FE0A0',
    marginRight: 6,
  },

  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },

  scannerArea: {
    position: 'absolute',
    top: '21%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 28,
  },

  scanInstruction: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 23,
  },

  scannerFrame: {
    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },

  corner: {
    position: 'absolute',
    width: 43,
    height: 43,
    borderColor: '#D7AE83',
  },

  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 17,
  },

  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 17,
  },

  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 17,
  },

  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 17,
  },

  qrPlaceholder: {
    width: '78%',
    height: '78%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    overflow: 'hidden',
  },

  scanLine: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '50%',
    height: 2,
    backgroundColor: '#D7AE83',
    opacity: 0.95,
    shadowColor: '#D7AE83',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },

  detectedIcon: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(46, 125, 50, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  helperText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 18,
    maxWidth: 300,
  },

  // Compact bottom information card
  bottomCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 12,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },

  cardHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1E5D9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  cardTextContainer: {
    flex: 1,
    marginLeft: 10,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  cardSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 15,
    marginTop: 2,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },

  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  tipText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.textSecondary,
  },

  resultHeading: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  resultIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  successBackground: {
    backgroundColor: '#E4F3E7',
  },

  errorBackground: {
    backgroundColor: '#FBE9E7',
  },

  resultTextContainer: {
    flex: 1,
    marginLeft: 10,
  },

  resultTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  resultSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.textSecondary,
    marginTop: 3,
  },

  loader: {
    marginTop: 12,
  },

  buttonContainer: {
    marginTop: 12,
  },

  retryHint: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },

  confirmationNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF5EC',
    borderRadius: 10,
    padding: 8,
    marginTop: 12,
  },

  confirmationText: {
    flex: 1,
    fontSize: 11,
    color: '#2E7D32',
    marginLeft: 7,
    fontWeight: '600',
  },

  permissionContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },

  permissionIcon: {
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: '#F1E5D9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },

  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },

  permissionSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },

  permissionButton: {
    width: '100%',
  },
});
