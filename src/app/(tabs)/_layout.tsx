import { Tabs } from 'expo-router';

import Ionicons from '@expo/vector-icons/Ionicons';
import { ClosetProvider } from '@/context/ClosetContext';
import HeaderBanner from '@/components/HeaderBanner';


export default function TabLayout() {
  return (
    <ClosetProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#ffd33d',
          header: ({ options }) => <HeaderBanner title={options.title} />,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home-sharp' : 'home-outline'} color={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="closet"
          options={{
            title: 'My Closet',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'shirt' : 'shirt-outline'} color={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="outfits"
          options={{
            title: 'Outfits',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'grid' : 'grid-outline'} color={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="about"
          options={{
            title: 'About',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'information-circle' : 'information-circle-outline'} color={color} size={24}/>
            ),
          }}
        />
      </Tabs>
    </ClosetProvider>
  );
}
