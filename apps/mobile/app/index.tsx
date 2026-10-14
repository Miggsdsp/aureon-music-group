import { Link } from 'expo-router';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const GOLD = '#D6B16D';
export default function HomeScreen() {
  return <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>AUREON MUSIC GROUP</Text>
    <Text style={styles.title}>Music that moves you.</Text>
    <Text style={styles.subtitle}>One account. One subscription. Three streaming platforms.</Text>
    <View style={styles.panel}><Text style={styles.heading}>Welcome to Aureon</Text><Text style={styles.copy}>Your music universe is coming to iOS and Android.</Text></View>
    <Link href="/sign-in" style={styles.link}>Sign in to your Aureon account →</Link>
    <Text style={styles.note}>Existing website subscriptions will unlock mobile listening. No in-app purchases.</Text>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({root:{flex:1,backgroundColor:'#090B12'},content:{padding:28,paddingTop:75,gap:22},eyebrow:{color:GOLD,letterSpacing:3,fontSize:12,fontWeight:'700'},title:{color:'#FFFFFF',fontSize:42,fontWeight:'700'},subtitle:{color:'#C2C3CA',fontSize:17,lineHeight:26},panel:{backgroundColor:'#171923',borderRadius:18,padding:24,marginTop:25,gap:12},heading:{color:'#FFFFFF',fontSize:24,fontWeight:'700'},copy:{color:'#B5B6BE',fontSize:15},link:{color:GOLD,fontSize:17,fontWeight:'700',marginTop:12},note:{color:'#9699A5',fontSize:12,lineHeight:20}});
