import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const App = () => {
  const [repository, setRepository] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [commits, setCommits] = useState([]);

  const [audioContext, setAudioContext] = useState(null);

  useEffect(() => {
    setAudioContext(new AudioContext());

    return () => {
      if (audioContext) {
        audioContext.close();
      }
    };
  }, []);

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
    console.log("TimeDiff: ", timeDifferenceInSeconds, "Total Duration: ", totalDurationInSeconds);
    return (timeDifferenceInSeconds / totalDurationInSeconds) * 30000; // Map the note duration to fit within one minute
  };


  const calculateNoteFrequency = (i, commitId, note) => {
    const A4Frequency = 440; // A4 frequency in Hz
    const semitoneRatio = Math.pow(2, (note - 69)/12); // 12-tone equal temperament scale
    const semitonesFromA4 = note - 69; // MIDI note number of A4 is 69
    return (A4Frequency * semitoneRatio +  ((i * 200) % 2400 || 200));
  };

  const calculateDrumFrequency = async (commitSha) => {
    try {
      const response = await axios.get(`https://api.github.com/repos/${repository}/commits/${commitSha}`);
      const commitDetails = response.data;
      const numFilesChanged = commitDetails.files.length;
      return 50 + numFilesChanged * 10; // Adjust multiplier and base frequency as needed
    } catch (error) {
      console.error('Error fetching commit details:', error);
      return 50; // Default drum frequency if unable to fetch commit details
    }
  };

  const fetchAllCommits = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`https://api.github.com/repos/${repository}/commits?per_page=100`);
      let allCommits = [...response.data];
      let nextPage = getNextPage(response.headers.link);
      while (nextPage) {
        const nextPageResponse = await axios.get(nextPage);
        allCommits = [...allCommits, ...nextPageResponse.data];
        nextPage = getNextPage(nextPageResponse.headers.link);
      }
      allCommits = allCommits.reverse();
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

  const playMusicAndDrumsFromCommits = async () => {
    const firstCommitTime = commits[0].commit.author.date;
    const lastCommitTime = commits[commits.length - 1].commit.author.date;
    let totalDuration = (new Date(lastCommitTime) - new Date(firstCommitTime)) / 1000;

    for (let i = 0; i < commits.length; i++) {
        const commit = commits[i];
        const sha = commit.sha;
        //const noteValue = parseInt(sha.substr(0, 1), 16);
        const commitId = parseInt(sha.substr(0, 4), 16);
        const noteValue =  (i * i * i * i) % 16;
        const frequency = calculateNoteFrequency(i, commitId, noteValue); // Calculate frequency based on MIDI note number
        const nextCommitTime = i === commits.length - 1 ? new Date() : commits[i + 1].commit.author.date;
        if (i < commits.length - 1) {
          const noteDuration = calculateNoteDuration(commit.commit.author.date, nextCommitTime, firstCommitTime, lastCommitTime);
          playNote(frequency, noteDuration);
        }

        //const drumFrequency = await calculateDrumFrequency(commit.sha);
        //const drumDuration = calculateNoteDuration(commit.commit.author.date, nextCommitTime, firstCommitTime, lastCommitTime);

        //playDrum(drumFrequency, drumDuration);
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
      playMusicAndDrumsFromCommits(commits);
    } catch (error) {
      console.error('Error fetching commits:', error);
      setError('Error fetching commits. Please check the repository name.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
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
