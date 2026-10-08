import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<div className="p-4"><h1 className="text-2xl font-bold">Admin Panel</h1></div>} />
      </Routes>
    </Router>
  );
}
export default App;
