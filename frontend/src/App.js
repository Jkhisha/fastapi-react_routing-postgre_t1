import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useSearchParams,
  Link,
} from "react-router-dom";

/**
 * Very simple local "session":
 * - Save the logged-in user in localStorage so refresh keeps you logged in.
 */
function useSession() {
  const getUser = () => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const [user, setUser] = useState(getUser());

  const saveUser = (u) => {
    setUser(u);
    if (u) localStorage.setItem("user", JSON.stringify(u));
    else localStorage.removeItem("user");
  };

  return { user, setUser: saveUser };
}

function LoginPage({ setUser }) {
  const [name, setName] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!name) {
      alert("Enter a name");
      return;
    }
    try {
      const res = await fetch("http://localhost:8000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        alert("Login failed");
        return;
      }
      const data = await res.json(); // { id, name, permid }
      setUser(data);

      // Navigate to search with current_id in URL (routing carries the state)
      navigate(`/search?current_id=${data.id}`);
    } catch (e) {
      console.error(e);
      alert("Network error");
    }
  };

  return (
    <div>
      <h2>Login</h2>
      <input
        placeholder="Enter your name (e.g., Akash)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button onClick={handleLogin}>Login</button>
    </div>
  );
}

function SearchPage({ user }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read params from URL
  const currentIdParam = searchParams.get("current_id");
  const minAgeParam = searchParams.get("min_age") || "";

  const [results, setResults] = useState([]);

  // Ensure we have a current user id in URL; if not, try from localStorage
  useEffect(() => {
    if (!currentIdParam) {
      if (user && user.id) {
        // Add current_id to URL
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set("current_id", String(user.id));
          return next;
        });
      } else {
        // Not logged in → go to login
        navigate("/");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdParam, user]);

  // Fetch whenever relevant query params change (URL-driven)
  useEffect(() => {
    const currentId = searchParams.get("current_id");
    const minAge = searchParams.get("min_age"); // may be null

    if (!currentId) return;

    const url = new URL("http://localhost:8000/search");
    url.searchParams.set("current_id", currentId);
    if (minAge) url.searchParams.set("min_age", minAge);

    fetch(url.toString())
      .then((res) => res.json())
      .then((data) => {
        setResults(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error(err);
        setResults([]);
      });
  }, [searchParams]);

  // Update URL when user types min age (kept simple: click Search to set it)
  const [minAgeInput, setMinAgeInput] = useState(minAgeParam);

  useEffect(() => {
    // keep input box in sync if URL changes externally
    setMinAgeInput(minAgeParam);
  }, [minAgeParam]);

  const applySearch = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (minAgeInput) next.set("min_age", String(minAgeInput));
      else next.delete("min_age");
      return next;
    });
  };

  const clearSearch = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("min_age");
      return next;
    });
  };

  return (
    <div>
      <h2>Search (URL-driven)</h2>
      <div>
        <input
          placeholder="Min age"
          value={minAgeInput}
          onChange={(e) => setMinAgeInput(e.target.value)}
        />
        <button onClick={applySearch}>Search</button>
        <button onClick={clearSearch}>Clear</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <strong>Current URL params:</strong>{" "}
        {decodeURIComponent(searchParams.toString() || "(none)")}
      </div>

      <ul style={{ marginTop: 12 }}>
        {results.map((r) => (
          <li key={r.id}>
            {r.id} — {r.name} — age {r.age} — {r.sex}
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 12 }}>
        <Link to="/">Back to Login</Link>
      </div>
    </div>
  );
}

function App() {
  const { user, setUser } = useSession();

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage setUser={setUser} />} />
        <Route path="/search" element={<SearchPage user={user} />} />
      </Routes>
    </Router>
  );
}

export default App;
