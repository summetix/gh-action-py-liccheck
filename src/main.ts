import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as fs from 'fs'
import * as style from 'ansi-styles'

export interface IActionInputs {
  readonly strategyIniFile: string
  readonly level: string
  readonly requirementsTxtFile: string
  readonly reportingTxtFile: string
  readonly noDeps: string
}

export async function parseInputs(): Promise<IActionInputs> {
  try {
    const inputs: IActionInputs = Object.freeze({
      strategyIniFile: core.getInput('strategy-ini-file'),
      level: core.getInput('level').toUpperCase(),
      requirementsTxtFile: core.getInput('requirements-txt-file'),
      reportingTxtFile: core.getInput('reporting-txt-file'),
      noDeps: core.getInput('no-deps'),
    })
    return inputs
  } catch (error) {
    throw error
  }
}

async function readFileAndApplyStyle(
  file: string,
  style_open: string,
  style_close: string
): Promise<string> {
  try {
    const content = fs
      .readFileSync(file, 'utf-8')
      .trim()
      .split('\n')
      .map((line) => `${style_open}${line}${style_close}`)
      .join('\n')

    return content
  } catch (error) {
    throw error
  }
}

async function run(): Promise<void> {
  try {
    const inputs = await core.group('Gathering Inputs...', parseInputs)

    const PythonPath: string = await core.group(
      'Getting python executable path ...',
      async () => {
        const pythonExe: string = await io.which('python', true)
        core.info(
          `${style.cyan.open}Python path: ${pythonExe}${style.cyan.close}`
        )
        return pythonExe
      }
    )

    await core.group('Installing liccheck...', async () => {
      await exec.exec(`"${PythonPath}"`, ['-m', 'pip', 'install', 'liccheck'])
    })

    const liccheckPath: string = await core.group(
      'Getting liccheck executable path ...',
      async () => {
        const liccheckExe: string = await io.which('liccheck', true)
        core.info(
          `${style.cyan.open}liccheck path: ${liccheckExe}${style.cyan.close}`
        )
        return liccheckExe
      }
    )

    await core.group('Strategy to use...', async () => {
      core.info(typeof style.bold)
      const strategy = await readFileAndApplyStyle(
        inputs.strategyIniFile,
        style.bold.open,
        style.bold.close
      )
      core.info(strategy)
    })

    await core.group('Checking licenses for ...', async () => {
      const requirements = await readFileAndApplyStyle(
        inputs.requirementsTxtFile,
        style.bold.open,
        style.bold.close
      )
      core.info(requirements)
    })

    const commandOptions: string[] = []
    const tomls = ['pyproject.toml', './pyproject.toml']
    if (!tomls.includes(inputs.strategyIniFile)) {
      commandOptions.push(...['-s', inputs.strategyIniFile])
    }

    commandOptions.push(
      ...[
        '-r',
        inputs.requirementsTxtFile,
        '-l',
        inputs.level,
        '-R',
        inputs.reportingTxtFile,
      ]
    )

    if (inputs.noDeps === 'true') {
      commandOptions.push('--no-deps')
    }

    type customError = {
      message: string
      status: boolean
    }

    const errors: customError = { message: '', status: false }

    await core.group('Running the license checker...', async () => {
      try {
        await exec.exec(`"${liccheckPath}"`, commandOptions)
      } catch (error) {
        errors.message = error.message
        errors.status = true
      }
    })
    core.info(`${style.cyan.open}License Checker Report ...${style.cyan.close}`)
    const report = await readFileAndApplyStyle(
      inputs.reportingTxtFile,
      style.bold.open,
      style.bold.close
    )
    core.info(report)
    if (errors.status === true) {
      core.setFailed(
        `${errors.message}. Found incompatible and/or unknown licenses. ${style.bold.open}For more information, check the 'Running the license checker...' and 'License checker report' sections..${style.bold.close}`
      )
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
