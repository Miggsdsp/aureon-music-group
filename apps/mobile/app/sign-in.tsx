import { Link } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function SignInScreen() {
  return <SafeAreaView style={styles.root}><View style={styles.content}><Text style={styles.heading}>Sign in</Text><Text style={styles.copy}>Existing Aureon account authentication will be connected in Phase 2. No credentials are collected by this placeholder.</Text><Link href="/" style={styles.link}>← Back to home</Link></View></SafeAreaView>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#090B12'},content:{padding:28,paddingTop:90,gap:22},heading:{color:'#FFFFFF',fontSize:34,fontWeight:'700'},copy:{color:'#C2C3CA',fontSize:16,lineHeight:25},link:{color:'#D6B16D',fontSize:16}});
