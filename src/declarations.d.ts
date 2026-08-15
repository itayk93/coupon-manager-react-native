declare module "react-native" {
  export const StyleSheet: any;
  export const View: any;
  export const Text: any;
  export const TextInput: any;
  export const TouchableOpacity: any;
  export const ScrollView: any;
  export const FlatList: any;
  export const SafeAreaView: any;
  export const Image: any;
  export const Switch: any;
  export const ActivityIndicator: any;
  export const Modal: any;
  export const KeyboardAvoidingView: any;
  export const Alert: any;
  export const Platform: any;
  export const StatusBar: any;
  export const I18nManager: any;
  export const Share: any;
  export const useColorScheme: any;
  export const RefreshControl: any;
  export type ViewStyle = any;
  export type TextStyle = any;
  export type ImageStyle = any;
  export type TextInputProps = any;
}

declare module "expo" {
  export const registerRootComponent: (component: any) => void;
}

declare module "expo-status-bar" {
  export const StatusBar: any;
}

declare module "react-native-safe-area-context" {
  export const SafeAreaProvider: any;
  export const SafeAreaView: any;
}

declare module "@react-navigation/native" {
  export const NavigationContainer: any;
  export const DefaultTheme: any;
  export const DarkTheme: any;
  export const useNavigation: any;
  export const useRoute: any;
  export type NavigatorScreenParams<T> = any;
  export type CompositeScreenProps<A, B> = any;
}

declare module "@react-navigation/native-stack" {
  export const createNativeStackNavigator: any;
  export type NativeStackScreenProps<T, K extends keyof T = keyof T> = {
    navigation: any;
    route: { params: T[K]; name: K };
  };
}

declare module "@react-navigation/bottom-tabs" {
  export const createBottomTabNavigator: any;
  export type BottomTabScreenProps<T, K extends keyof T = keyof T> = {
    navigation: any;
    route: { params: T[K]; name: K };
  };
}

declare module "lucide-react-native" {
  export const WalletCards: any;
  export const Tag: any;
  export const QrCode: any;
  export const BarChart3: any;
  export const Settings: any;
  export const Sparkles: any;
  export const ReceiptText: any;
  export const CirclePlus: any;
  export const ListChecks: any;
  export const Building2: any;
  export const ChevronLeft: any;
  export const ChevronRight: any;
  export const ChevronDown: any;
  export const ChevronUp: any;
  export const Plus: any;
  export const PlusCircle: any;
  export const X: any;
  export const Search: any;
  export const Copy: any;
  export const Check: any;
  export const CheckCircle2: any;
  export const Calendar: any;
  export const Eye: any;
  export const EyeOff: any;
  export const AlertTriangle: any;
  export const AlertCircle: any;
  export const RefreshCw: any;
  export const Edit3: any;
  export const Trash2: any;
  export const Share2: any;
  export const ExternalLink: any;
  export const Clock: any;
  export const History: any;
  export const Camera: any;
  export const RotateCcw: any;
  export const FileText: any;
  export const Download: any;
  export const TrendingUp: any;
  export const PieChart: any;
  export const Users: any;
  export const UserCheck: any;
  export const User: any;
  export const UserPlus: any;
  export const Mail: any;
  export const Lock: any;
  export const LogIn: any;
  export const LogOut: any;
  export const ArrowRight: any;
  export const Shield: any;
  export const ShieldCheck: any;
  export const Moon: any;
  export const Sun: any;
  export const Bell: any;
  export const HelpCircle: any;
  export const Send: any;
  export const MessageSquare: any;
  export const Layers: any;
  export const Zap: any;
  export const Heart: any;
  export const SlidersHorizontal: any;
  export const Info: any;
  export const KeyRound: any;
}

declare module "react-native-qrcode-svg" {
  const QRCodeSVG: any;
  export default QRCodeSVG;
}

declare module "expo-camera" {
  export const CameraView: any;
  export const useCameraPermissions: () => [any, () => Promise<any>];
}

declare module "expo-clipboard" {
  export const setStringAsync: (text: string) => Promise<boolean>;
  export const getStringAsync: () => Promise<string>;
}

declare module "expo-haptics" {
  export enum NotificationFeedbackType {
    Success = "success",
    Warning = "warning",
    Error = "error",
  }
  export const notificationAsync: (type?: NotificationFeedbackType) => Promise<void>;
  export const selectionAsync: () => Promise<void>;
}

declare module "expo-sharing" {
  export const isAvailableAsync: () => Promise<boolean>;
  export const shareAsync: (url: string, options?: any) => Promise<any>;
}

declare module "expo-file-system" {
  export const documentDirectory: string;
  export enum EncodingType {
    UTF8 = "utf8",
    Base64 = "base64",
  }
  export const writeAsStringAsync: (fileUri: string, contents: string, options?: any) => Promise<void>;
  export const readAsStringAsync: (fileUri: string, options?: any) => Promise<string>;
}

declare module "expo-web-browser" {
  export const openBrowserAsync: (url: string, options?: any) => Promise<any>;
}

declare module "expo-constants" {
  const Constants: any;
  export default Constants;
}

declare module "@react-native-async-storage/async-storage" {
  const AsyncStorage: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
    clear: () => Promise<void>;
  };
  export default AsyncStorage;
}
