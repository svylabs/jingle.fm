import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const App = () => {
  const [repository, setRepository] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [commits, setCommits] = useState([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [promptAuthentication, setPromptAuthentication] = useState(false);
  const [user, setUser] = useState({});

  const [audioContext, setAudioContext] = useState(null);

  useEffect(() => {
    setAudioContext(new AudioContext());
    localStorage.getItem('githubAuthToken') && setAuthenticated(true);
    fetch('/auth/user')
      .then(res => res.json())
      .then(user => {
        if (user) {
          setAuthenticated(true);
          localStorage.setItem('githubAuthToken', user.access_token);
          localStorage.setItem('userDetails', JSON.stringify(user));
          setUser(user);
        }
      })

    return () => {
      if (audioContext) {
        audioContext.close();
      }
    };
  }, []);

  useEffect(() => {
    console.log(commits);
    if (commits && commits.length > 0) {
      playMusicAndDrumsFromCommits(commits);
    }
  }, [commits]);

  const playNote = (frequency, duration) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.setValueAtTime(1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
    }, duration);
};


  const playDrum = (frequency, duration) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.setValueAtTime(1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
    }, duration);
  };

  const calculateNoteDuration = (commitTime, nextCommitTime, firstCommitTime, lastCommitTime) => {
    const timeDifferenceInSeconds = (new Date(nextCommitTime) - new Date(commitTime)) / 1000;
    const totalDurationInSeconds = (new Date(lastCommitTime) - new Date(firstCommitTime)) / 1000;
    //console.log("TimeDiff: ", timeDifferenceInSeconds, "Total Duration: ", totalDurationInSeconds);
    return (timeDifferenceInSeconds / totalDurationInSeconds) * 20000; // Map the note duration to fit within one minute
  };


  const calculateNoteFrequency = (i, commitId, note) => {
    const A4Frequency = 440; // A4 frequency in Hz
    const semitoneRatio = Math.pow(2, (note - 69)/12); // 12-tone equal temperament scale
    const semitonesFromA4 = note - 69; // MIDI note number of A4 is 69
    return (A4Frequency * semitoneRatio +  ((i * 200) % 2400 || 200));
  };

  const calculateDrumFrequency = async (commit) => {
    try {
      const numFilesChanged = commit.files.length;
      return 50 + numFilesChanged * 10; // Adjust multiplier and base frequency as needed
    } catch (error) {
      console.error('Error fetching commit details:', error);
      return 50; // Default drum frequency if unable to fetch commit details
    }
  };

  const fetchAllCommits = async () => {
    try {
      setIsLoading(true);
      const response = await axios(`https://api.github.com/repos/${repository}/commits?per_page=100`);
      let allCommits = [...response.data];
      let i = 0;
      let nextPage = getNextPage(response.headers.link);
      while (nextPage && i < 10) {
        i++;
        const nextPageResponse = await axios.get(nextPage);
        allCommits = [...allCommits, ...nextPageResponse.data];
        nextPage = getNextPage(nextPageResponse.headers.link);
        if (allCommits.length > 20 && !authenticated) {
          // Prompt the user to log in with GitHub
          // Implement GitHub OAuth flow here
          setPromptAuthentication(true);
          setError('This repo has more commits than we can process, login with GitHub to avoid Github API rate limits.');
          return;
        }
      }
      allCommits = allCommits.reverse();
      console.log(allCommits);
      setCommits(allCommits);
    } catch (error) {
      console.error('Error fetching commits:', error);
      setError('Error fetching commits. Please check the repository name.');
    } finally {
      setIsLoading(false);
    }
  };

  const getNextPage = (linkHeader) => {
    if (!linkHeader) return null;
    const links = linkHeader.split(', ');
    for (const link of links) {
      const [url, rel] = link.split('; ');
      if (rel.includes('next')) {
        return url.slice(1, -1); // Remove angle brackets around the URL
      }
    }
    return null;
  };

  const fetchCommitDetails = async (commitSha) => {
    try {
      const response = await axios.get(`https://api.github.com/repos/${repository}/commits/${commitSha}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching commit details:', error);
      return null;
    }
  }

  const playMusicAndDrumsFromCommits = async (commits) => {
    const firstCommitTime = commits[0].commit.author.date;
    const lastCommitTime = commits[commits.length - 1].commit.author.date;
    let totalDuration = (new Date(lastCommitTime) - new Date(firstCommitTime)) / 1000;
    let notes = [
      // { 'note': [fqy, duration], 'drum': [] }
    ]

    for (let i = 0; i < commits.length; i++) {
        let note = {};
        const commit = commits[i];
        const sha = commit.sha;
        console.log("Commit: ", commit);
        const commitDetails = await fetchCommitDetails(sha);
        commit.files = commitDetails.files;
        //const noteValue = parseInt(sha.substr(0, 1), 16);
        const commitId = parseInt(sha.substr(0, 4), 16);
        const noteValue =  (i * i * i * i) % 16;
        const frequency = calculateNoteFrequency(i, commitId, noteValue); // Calculate frequency based on MIDI note number
        const nextCommitTime = i === commits.length - 1 ? new Date() : commits[i + 1].commit.author.date;
        if (i < commits.length - 1) {
          const noteDuration = calculateNoteDuration(commit.commit.author.date, nextCommitTime, firstCommitTime, lastCommitTime);
          note.note = [frequency, noteDuration];
          const drumFrequency = await calculateDrumFrequency(commit);
          const drumDuration = calculateNoteDuration(commit.commit.author.date, nextCommitTime, firstCommitTime, lastCommitTime);
          note.drum = [drumFrequency, drumDuration];
          notes.push(note);
        }
    }

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i].note;
      const drum = notes[i].drum;
      playNote(note[0], note[1]);
      playDrum(drum[0], drum[1]);
    }
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      //const response = await axios.get(`https://api.github.com/repos/${repository}/commits`);
      //const commits = response.data;
      await fetchAllCommits();
      console.log("Commits: ", commits);
    } catch (error) {
      console.error('Error fetching commits:', error);
      setError('Error fetching commits. Please check the repository name.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      {authenticated && user &&  <h3>Welcome, {user.login}</h3>}
      <h1>Tune for your repo</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="repository">Repository:</label>
        <input 
          type="text" 
          id="repository" 
          value={repository} 
          onChange={(e) => setRepository(e.target.value)} 
          required 
        />
        <button type="submit" disabled={isLoading}>{isLoading ? 'Loading...' : 'Submit'}</button>
      </form>
      {error && <p>{error}</p>}
      {!authenticated && promptAuthentication && <a href="https://github.com/login/oauth/authorize?client_id=0962e87303b69b832dc7">Login with Github</a>}
      <div className="visualizer">
        <div className="visualizer-bar"></div>
        <div className="visualizer-bar"></div>
        <div className="visualizer-bar"></div>
        <div className="visualizer-bar"></div>
        <div className="visualizer-bar"></div>
      </div>
    </div>
  );
};

export default App;
