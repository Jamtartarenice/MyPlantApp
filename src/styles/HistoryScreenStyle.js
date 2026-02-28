import { StyleSheet, Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

export default StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1e2b3c', marginBottom: 20 },
  rangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  rangeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
  },
  rangeButtonActive: { backgroundColor: '#4CAF50' },
  rangeButtonText: { fontSize: 14, color: '#333' },
  rangeButtonTextActive: { color: '#fff', fontWeight: 'bold' },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chart: { marginVertical: 8, borderRadius: 16 },
  statsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statsTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8, color: '#333' },
  noData: { textAlign: 'center', color: '#999', marginVertical: 20 },
  error: { color: '#F44336', fontSize: 16, textAlign: 'center', marginTop: 20 },
  optimalText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
    fontStyle: 'italic',
  },
});