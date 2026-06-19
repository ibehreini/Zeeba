import ClosetList from '@/components/ClosetList';
import { Closet_Data } from '@/constants/closetData';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

export default function Index() {
  const router = useRouter();

  // THE BRAIN: This function "captures" the ID sent from below
  const handleNavigation = (id: string) => {
  router.push({
    pathname: '/closet/[id]', // This matches the filename src/app/closet/[id].tsx
    params: { id: id }         // This fills in the [id] part
  });
};

  return (
    <ClosetList 
      items={Closet_Data} 
      onItemPress={handleNavigation} 
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    paddingTop: 50,
  },
  title: {
    color: '#000',
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  button: {
    fontSize: 20,
    textDecorationLine: 'underline',
    color: '#fff',
    alignSelf: 'center',
    marginVertical: 16,
  },
});
