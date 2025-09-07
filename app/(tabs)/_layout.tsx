import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { supabase, User } from '@/lib/supabase';

export default function TabLayout() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      setUser(data);
    }
  };

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#3B82F6',
          tabBarInactiveTintColor: '#6B7280',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            height: 60,
            paddingBottom: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: user?.role === 'faculty' ? 'Faculty Dashboard' : 'Take Attendance',
            tabBarIcon: ({ size, color }) => (
              <MaterialIcons name={user?.role === 'faculty' ? 'school' : 'assignment'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="mark"
          options={{
            title: user?.role === 'student' ? 'Mark Attendance' : 'Student View',
            tabBarIcon: ({ size, color }) => (
              <MaterialIcons name="how-to-reg" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ size, color }) => (
              <MaterialIcons name="person" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
      <StatusBar style="dark" />
    </>
  );
}