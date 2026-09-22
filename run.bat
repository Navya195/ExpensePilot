@echo off
set "BASE_DIR=%~dp0"
set "BASE_DIR=%BASE_DIR:~0,-1%"
set "JAVA_HOME=C:\Program Files\Java\jdk-24"
set "MAVEN_HOME=%BASE_DIR%\apache-maven-3.9.6"
set "JAVACMD=%JAVA_HOME%\bin\java.exe"
set "CLASSWORLDS_JAR=%MAVEN_HOME%\boot\plexus-classworlds-2.7.0.jar"
set "CLASSWORLDS_LAUNCHER=org.codehaus.plexus.classworlds.launcher.Launcher"

echo Starting SpendWise on http://localhost:8080
echo.

"%JAVACMD%" ^
  -classpath "%CLASSWORLDS_JAR%" ^
  -Dclassworlds.conf="%MAVEN_HOME%\bin\m2.conf" ^
  -Dmaven.home="%MAVEN_HOME%" ^
  -Dlibrary.jansi.path="%MAVEN_HOME%\lib\jansi-native" ^
  -Dmaven.multiModuleProjectDirectory="%BASE_DIR%" ^
  %CLASSWORLDS_LAUNCHER% tomcat7:run
