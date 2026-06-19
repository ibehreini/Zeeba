import OutfitFlatLay from '@/components/OutfitFlatLay';
import { StyleSheet, Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>My outfits screen</Text>
            <View style={{ width: '100%', flex: 1 }}>
        <OutfitFlatLay 
          itemIds={['shirt_1', 'pants_2']} 
          itemImages={{ 
            shirt_1: require('../../../../assets/images/clothes/top.jpg'), 
            pants_2: require('../../../../assets/images/clothes/pants.jpg') 
          }} 
        />
</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#000',
  },
});
