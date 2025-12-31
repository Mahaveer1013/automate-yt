import sqlite3 from 'sqlite3';
import { Logger } from '../utils/logger.js';

const logger = new Logger('Database');

export class Database {
  private db: sqlite3.Database | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    if (this.isConnected) return;

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database('./data/automation.db', (err) => {
        if (err) {
          logger.error('Failed to connect to database', err);
          reject(err);
          return;
        }

        this.isConnected = true;
        logger.info('Database connected');

        // Initialize tables
        this.initializeTables()
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  private async initializeTables(): Promise<void> {
    const createTables = `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        video_id TEXT UNIQUE,
        topic TEXT NOT NULL,
        script TEXT NOT NULL,
        metadata TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending'
      );

      CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        views INTEGER DEFAULT 0,
        watch_time INTEGER DEFAULT 0,
        average_view_duration REAL DEFAULT 0,
        average_view_percentage REAL DEFAULT 0,
        likes INTEGER DEFAULT 0,
        dislikes INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        ctr REAL DEFAULT 0,
        estimated_revenue REAL DEFAULT 0,
        cpm REAL DEFAULT 0,
        FOREIGN KEY (video_id) REFERENCES projects (video_id)
      );

      CREATE TABLE IF NOT EXISTS optimizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        actions TEXT NOT NULL,
        changes TEXT NOT NULL,
        improvements TEXT NOT NULL,
        FOREIGN KEY (video_id) REFERENCES projects (video_id)
      );

      CREATE TABLE IF NOT EXISTS scoring_weights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        factor TEXT UNIQUE NOT NULL,
        weight REAL DEFAULT 1.0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
      CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date);
    `;

    await this.execQuery(createTables);

    // Initialize default weights if not exists
    await this.initializeDefaultWeights();
  }

  private async initializeDefaultWeights(): Promise<void> {
    const defaultWeights = [
      ['searchVolume', 0.4],
      ['estimatedRPM', 0.4],
      ['competition', 0.2],
      ['thumbnailQuality', 0.3],
      ['contentDepth', 0.3]
    ];

    for (const [factor, weight] of defaultWeights) {
      await this.runQuery(
        'INSERT OR IGNORE INTO scoring_weights (factor, weight) VALUES (?, ?)',
        [factor, weight]
      );
    }
  }

  private execQuery(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }


  private runQuery(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      this.db.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  private allQuery(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async saveProject(project: any): Promise<void> {
    await this.runQuery(
      'INSERT INTO projects (id, video_id, topic, script, metadata, status) VALUES (?, ?, ?, ?, ?, ?)',
      [
        project.id,
        project.videoId,
        JSON.stringify(project.topic),
        JSON.stringify(project.script),
        JSON.stringify(project.metadata),
        project.status || 'uploaded'
      ]
    );
  }

  async saveAnalytics(videoId: string, analytics: any): Promise<void> {
    await this.runQuery(
      `INSERT INTO analytics (
        video_id, views, watch_time, average_view_duration,
        average_view_percentage, likes, dislikes, shares,
        comments, impressions, ctr, estimated_revenue, cpm
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        videoId,
        analytics.views || 0,
        analytics.watchTime || 0,
        analytics.averageViewDuration || 0,
        analytics.averageViewPercentage || 0,
        analytics.likes || 0,
        analytics.dislikes || 0,
        analytics.shares || 0,
        analytics.comments || 0,
        analytics.impressions || 0,
        analytics.impressionsClickThroughRate || 0,
        analytics.estimatedRevenue || 0,
        analytics.cpm || 0
      ]
    );
  }

  async saveOptimizationResult(videoId: string, result: any): Promise<void> {
    await this.runQuery(
      'INSERT INTO optimizations (video_id, actions, changes, improvements) VALUES (?, ?, ?, ?)',
      [
        videoId,
        JSON.stringify(result.actions),
        JSON.stringify(result.changes),
        JSON.stringify(result.nextRunImprovements)
      ]
    );
  }

  async getScoringWeights(): Promise<Record<string, number>> {
    const rows = await this.allQuery('SELECT factor, weight FROM scoring_weights');
    const weights: Record<string, number> = {};

    rows.forEach(row => {
      weights[row.factor] = row.weight;
    });

    return weights;
  }

  async updateScoringWeight(factor: string, weight: number): Promise<void> {
    await this.runQuery(
      'UPDATE scoring_weights SET weight = ?, last_updated = CURRENT_TIMESTAMP WHERE factor = ?',
      [weight, factor]
    );
  }

  async getRecentProjects(limit: number = 10): Promise<any[]> {
    const rows = await this.allQuery(
      'SELECT * FROM projects ORDER BY created_at DESC LIMIT ?',
      [limit]
    );

    return rows.map(row => ({
      ...row,
      topic: JSON.parse(row.topic),
      script: JSON.parse(row.script),
      metadata: JSON.parse(row.metadata)
    }));
  }

  async disconnect(): Promise<void> {
    if (!this.db || !this.isConnected) return;

    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) {
          logger.error('Failed to disconnect from database', err);
          reject(err);
        } else {
          this.isConnected = false;
          this.db = null;
          logger.info('Database disconnected');
          resolve();
        }
      });
    });
  }
}
