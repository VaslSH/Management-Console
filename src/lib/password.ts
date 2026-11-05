import SparkMD5 from 'spark-md5';

export function hashPassword(password: string) {
  return SparkMD5.hash(password);
}
