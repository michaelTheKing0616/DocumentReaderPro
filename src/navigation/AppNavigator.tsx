import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { useTranslation } from '../i18n';
import { useTheme } from '../theme/useTheme';

import { OnboardingScreen } from '../screens/Onboarding';
import { HomeScreen } from '../screens/HomeScreen';
import { CalibrationScreen } from '../screens/CalibrationScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { ReaderScreen } from '../screens/Reader';
import { SettingsScreen } from '../screens/Settings';
import { LessonsScreen } from '../screens/Lessons';
import { TrueScanScreen } from '../screens/TrueScanScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { ParentDashboardScreen } from '../screens/ParentDashboardScreen';
import { PdfToolsScreen } from '../screens/PdfToolsScreen';
import { CloudDriveScreen } from '../screens/CloudDriveScreen';
import { CollaborationScreen } from '../screens/CollaborationScreen';
import { EnterpriseOrgSettingsScreen } from '../screens/EnterpriseOrgSettingsScreen';
import {
  LessonGameScreen,
  LessonGameStackParamList,
} from '../screens/lessons/LessonGameScreen';
import { Document } from '../types';

export type RootStackParamList = {
  Onboarding: undefined;
  Calibration: undefined;
  Main: undefined;
  Reader: { document: Document };
  TrueScan: undefined;
  ParentDashboard: undefined;
  Auth: undefined;
  LessonGame: LessonGameStackParamList['LessonGame'];
  PdfTools: undefined;
  CloudDrive: undefined;
  Collaboration: undefined;
  EnterpriseOrgSettings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

type TabIconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, TabIconName> = {
  Library: 'library-outline',
  Dashboard: 'stats-chart-outline',
  Lessons: 'school-outline',
  Settings: 'settings-outline',
};

const MainTabs = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.borderSubtle,
        },
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={TAB_ICONS[route.name] ?? 'ellipse-outline'}
            size={size}
            color={color}
            style={focused ? { transform: [{ scale: 1.05 }] } : undefined}
          />
        ),
      })}
    >
      <Tab.Screen
        name="Library"
        component={HomeScreen}
        options={{
          tabBarLabel: t('navigation.library'),
          tabBarTestID: 'tab-library',
        }}
      />
      <Tab.Screen
        name="Dashboard"
        component={AnalyticsScreen}
        options={{ tabBarLabel: t('navigation.dashboard') }}
      />
      <Tab.Screen
        name="Lessons"
        component={LessonsScreen}
        options={{ tabBarLabel: t('navigation.lessons') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: t('navigation.settings') }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator: React.FC = () => {
  const isOnboardingComplete = useSelector(
    (state: RootState) => state.ux.isOnboardingComplete
  );
  const { t } = useTranslation();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isOnboardingComplete ? (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Calibration" component={CalibrationScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Reader" component={ReaderScreen} />
            <Stack.Screen name="Calibration" component={CalibrationScreen} />
            <Stack.Screen name="TrueScan" component={TrueScanScreen} />
            <Stack.Screen
              name="ParentDashboard"
              component={ParentDashboardScreen}
              options={{ headerShown: true, title: t('navigation.parentDashboard') }}
            />
            <Stack.Screen
              name="Auth"
              component={AuthScreen}
              options={{ headerShown: true, title: t('navigation.account') }}
            />
            <Stack.Screen
              name="LessonGame"
              component={LessonGameScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PdfTools"
              component={PdfToolsScreen}
              options={{ headerShown: true, title: t('navigation.pdfTools') }}
            />
            <Stack.Screen
              name="CloudDrive"
              component={CloudDriveScreen}
              options={{ headerShown: true, title: t('navigation.cloudDrive') }}
            />
            <Stack.Screen
              name="Collaboration"
              component={CollaborationScreen}
              options={{ headerShown: true, title: t('navigation.collaboration') }}
            />
            <Stack.Screen
              name="EnterpriseOrgSettings"
              component={EnterpriseOrgSettingsScreen}
              options={{ headerShown: true, title: t('navigation.organization') }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
